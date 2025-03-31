// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title FreelancerEscrow
 * @notice A decentralized escrow contract to automate milestone-based payments for freelance work.
 *         Includes a mediation fee for disputes and stores an IPFS hash referencing milestone definitions.
 */
contract FreelancerEscrow {
    // Addresses of the client (project payer), freelancer (worker), and assigned mediator (for disputes)
    address public client;
    address public freelancer;
    address public mediator;

    // Contract states for controlling function logic
    enum State { Created, InProgress, Disputed, Completed }
    State public contractState;

    // Total amount paid by the client for the project
    uint256 public projectFee;

    // Amount the freelancer is required to stake (security deposit)
    uint256 public freelancerStake;

    // Number of milestones in the project
    uint256 public numMilestones;

    // Index of the current milestone being worked on
    uint256 public currentMilestone;

    // Base fee required to open a dispute (economics of mediation)
    uint256 public constant mediationFee = 0.01 ether;

    // IPFS hash storing the entire milestone definitions/specifications
    // (each references an off-chain doc describing each milestone)
    string public projectIpfsHash;

    // Tracks each milestone's status
    struct Milestone {
        bool completed;    // Has freelancer submitted it as done?
        bool approved;     // Did client approve it?
        bool disputed;     // Is it under dispute?
        uint256 timestamp; // When it was marked completed (for auto-release logic)
    }

    // milestoneIndex -> Milestone data
    mapping(uint256 => Milestone) public milestones;

    // Tracks total dispute fees paid into the contract (if multiple disputes occur)
    uint256 public disputePot;

    // EVENTS
    event StakeDeposited(address indexed freelancer, uint256 amount);
    event MilestoneCompleted(uint256 indexed milestoneIndex, uint256 timestamp);
    event MilestoneApproved(uint256 indexed milestoneIndex, uint256 payment);
    event MilestoneDisputed(uint256 indexed milestoneIndex, address indexed initiator, uint256 fee);
    event DisputeResolved(uint256 indexed milestoneIndex, bool decision, uint256 payment);
    event AutoReleased(uint256 indexed milestoneIndex, uint256 payment);
    event StakeWithdrawn(address indexed freelancer, uint256 amount);

    /**
     * @dev Initializes the contract with basic project info.
     * @param _freelancer The address of the freelancer.
     * @param _mediator The address of the mediator.
     * @param _freelancerStake The required stake that the freelancer must deposit.
     * @param _numMilestones Number of milestones in the project.
     * @param _projectIpfsHash IPFS hash containing the milestone definitions.
     */
    constructor(
        address _freelancer,
        address _mediator,
        uint256 _freelancerStake,
        uint256 _numMilestones,
        string memory _projectIpfsHash
    )
        payable
    {
        require(msg.value > 0, "Project fee required");
        require(_numMilestones > 0, "Must have at least 1 milestone");

        client = msg.sender;
        freelancer = _freelancer;
        mediator = _mediator;
        freelancerStake = _freelancerStake;
        numMilestones = _numMilestones;
        projectFee = msg.value;
        projectIpfsHash = _projectIpfsHash;
        contractState = State.Created;
    }

    /**
     * @notice The freelancer deposits their stake, moving the contract into "InProgress" state.
     */
    function freelancerDepositStake() external payable {
        require(contractState == State.Created, "Contract must be in Created state");
        require(msg.sender == freelancer, "Only the freelancer can deposit stake");
        require(msg.value == freelancerStake, "Incorrect stake amount");

        // Transition to InProgress
        contractState = State.InProgress;

        // Initialize each milestone record
        for (uint256 i = 0; i < numMilestones; i++) {
            milestones[i] = Milestone(false, false, false, 0);
        }
        
        emit StakeDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Freelancer marks the current milestone as completed.
     * @dev Must be in InProgress, only the freelancer can call.
     * @param milestoneIndex The index of the milestone being completed.
     */
    function markMilestoneCompleted(uint256 milestoneIndex) external {
        require(contractState == State.InProgress, "Not in InProgress state");
        require(msg.sender == freelancer, "Only freelancer can mark completion");
        require(milestoneIndex == currentMilestone, "Wrong milestone index");
        require(!milestones[milestoneIndex].completed, "Already completed");

        milestones[milestoneIndex].completed = true;
        milestones[milestoneIndex].timestamp = block.timestamp;
        
        emit MilestoneCompleted(milestoneIndex, block.timestamp);
    }

    /**
     * @notice Client approves the current milestone, releasing payment to the freelancer.
     * @dev Must be InProgress, only the client can call, milestone must be completed & undisputed.
     * @param milestoneIndex The index of the milestone being approved.
     */
    function approveMilestone(uint256 milestoneIndex) external {
        require(contractState == State.InProgress, "Not in InProgress state");
        require(msg.sender == client, "Only client can approve");
        require(milestoneIndex == currentMilestone, "Wrong milestone index");
        require(milestones[milestoneIndex].completed, "Milestone not completed");
        require(!milestones[milestoneIndex].disputed, "Milestone under dispute");

        // Approve and pay out
        milestones[milestoneIndex].approved = true;
        uint256 milestonePayment = projectFee / numMilestones;
        payable(freelancer).transfer(milestonePayment);
        
        emit MilestoneApproved(milestoneIndex, milestonePayment);

        // Advance to the next milestone
        currentMilestone++;
        if (currentMilestone == numMilestones) {
            contractState = State.Completed;
        }
    }

    /**
     * @notice Either client or freelancer can dispute the current milestone if they disagree.
     * @dev Requires a mediation fee to be paid by whoever initiates the dispute.
     * @param milestoneIndex The index of the milestone being disputed.
     */
    function disputeMilestone(uint256 milestoneIndex) external payable {
        require(contractState == State.InProgress, "Not in InProgress state");
        require(milestoneIndex == currentMilestone, "Wrong milestone index");
        require(
            msg.sender == client || msg.sender == freelancer,
            "Only client or freelancer can dispute"
        );
        require(milestones[milestoneIndex].completed, "Milestone not completed yet");
        require(!milestones[milestoneIndex].approved, "Milestone already approved");
        require(!milestones[milestoneIndex].disputed, "Already under dispute");
        require(msg.value == mediationFee, "Must pay mediation fee");

        // Mark as disputed and set state to Disputed
        milestones[milestoneIndex].disputed = true;
        contractState = State.Disputed;
        disputePot += msg.value;

        emit MilestoneDisputed(milestoneIndex, msg.sender, msg.value);
    }

    /**
     * @notice Mediator resolves the dispute, awarding the milestone funds to either client or freelancer.
     *         Mediator collects the mediation fee from disputePot.
     * @param milestoneIndex The milestone under dispute.
     * @param decision True => freelancer wins, false => client wins.
     */
    function disputeResolution(uint256 milestoneIndex, bool decision) external {
        require(contractState == State.Disputed, "Contract not in Disputed state");
        require(msg.sender == mediator, "Only the mediator can resolve");
        require(milestones[milestoneIndex].disputed, "Milestone not in dispute");

        uint256 milestonePayment = projectFee / numMilestones;

        if (decision) {
            // Freelancer wins dispute
            payable(freelancer).transfer(milestonePayment);
        } else {
            // Client wins dispute, refund milestone portion
            payable(client).transfer(milestonePayment);
        }

        // Pay the mediator their fee from disputePot, if available
        if (disputePot >= mediationFee) {
            disputePot -= mediationFee;
            payable(mediator).transfer(mediationFee);
        }

        emit DisputeResolved(milestoneIndex, decision, milestonePayment);

        // Clear dispute and move to next milestone
        milestones[milestoneIndex].disputed = false;
        milestones[milestoneIndex].approved = decision;
        currentMilestone++;
        if (currentMilestone == numMilestones) {
            contractState = State.Completed;
        } else {
            contractState = State.InProgress;
        }
    }

    /**
     * @notice If the client is unresponsive, freelancer can call this to auto-release milestone funds after a grace period.
     * @param milestoneIndex The index of the milestone being auto-released.
     */
    function autoReleaseIfClientAbsent(uint256 milestoneIndex) external {
        require(contractState == State.InProgress, "Must be InProgress");
        require(msg.sender == freelancer, "Only freelancer can auto-release");
        require(milestoneIndex == currentMilestone, "Wrong milestone index");
        require(!milestones[milestoneIndex].disputed, "Milestone is disputed");
        require(milestones[milestoneIndex].completed, "Milestone not completed");

        // Enforce a 3-day grace period
        require(
            block.timestamp >= milestones[milestoneIndex].timestamp + 3 days,
            "Grace period not reached"
        );

        uint256 milestonePayment = projectFee / numMilestones;
        payable(freelancer).transfer(milestonePayment);
        emit AutoReleased(milestoneIndex, milestonePayment);

        milestones[milestoneIndex].approved = true;
        currentMilestone++;
        if (currentMilestone == numMilestones) {
            contractState = State.Completed;
        }
    }

    /**
     * @notice Once all milestones are completed, freelancer withdraws their original stake and any remaining funds.
     */
    function withdrawRemainingStake() external {
        require(contractState == State.Completed, "Project not completed yet");
        require(msg.sender == freelancer, "Only freelancer can withdraw stake");

        uint256 amount = address(this).balance;
        payable(freelancer).transfer(amount);
        emit StakeWithdrawn(freelancer, amount);

        // selfdestruct to clean up contract storage
        // selfdestruct(payable(client));
    }
}

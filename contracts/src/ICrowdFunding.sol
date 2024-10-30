// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface ICrowdFunding {
    struct Task {
        string name;
        uint32 taskCreatedBlock;
        uint256 goalAmount;  // Campaign goal amount
        uint256 fundsRaised; // Total funds raised
        uint256 deadline;    // Campaign deadline timestamp
    }

    event NewTaskCreated(uint32 indexed taskIndex, Task task);
    event TaskResponded(uint32 indexed taskIndex, string name, address operator);
    event DonationReceived(uint32 indexed campaignId, uint256 amount, address donor);

    function latestTaskNum() external view returns (uint32);
    function allTaskHashes(uint32 taskIndex) external view returns (bytes32);
    function allTaskResponses(address operator, uint32 taskIndex) external view returns (bytes memory);

    function createNewTask(
        string memory name,
        uint256 goalAmount,
        uint256 duration
    ) external returns (uint32);

    function respondToTask(uint32 taskIndex, string memory message) external;

    function donateToTask(uint32 taskIndex) external payable;

    function checkCampaignStatus(uint32 taskIndex) external view returns (bool);
}

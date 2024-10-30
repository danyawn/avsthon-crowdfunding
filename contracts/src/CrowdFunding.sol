// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {ECDSAServiceManagerBase} from "@eigenlayer-middleware/src/unaudited/ECDSAServiceManagerBase.sol";
import {ECDSAStakeRegistry} from "@eigenlayer-middleware/src/unaudited/ECDSAStakeRegistry.sol";
import {IServiceManager} from "@eigenlayer-middleware/src/interfaces/IServiceManager.sol";
import {ECDSAUpgradeable} from "@openzeppelin-upgrades/contracts/utils/cryptography/ECDSAUpgradeable.sol";
import {ICrowdFunding} from "./ICrowdFunding.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@eigenlayer/contracts/interfaces/IRewardsCoordinator.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title CrowdFunding
 * @notice Manages crowdfunding campaigns with AVS support via Eigenlayer
 */
contract CrowdFunding is ECDSAServiceManagerBase, ICrowdFunding {
    using ECDSAUpgradeable for bytes32;

    uint32 public latestTaskNum;

    // Mapping of campaign indices to all campaign hashes
    mapping(uint32 => bytes32) public allTaskHashes;

    // Mapping of campaign indices to store campaigns by their ID
    mapping(uint32 => Task) public allCampaigns;

    // Mapping of campaign indices to hash of abi.encode(taskResponse, taskResponseMetadata)
    mapping(address => mapping(uint32 => bytes)) public allTaskResponses;

    modifier onlyOperator() {
        require(
            ECDSAStakeRegistry(stakeRegistry).operatorRegistered(msg.sender),
            "Operator must be the caller"
        );
        _;
    }

    constructor(
        address _avsDirectory,
        address _stakeRegistry,
        address _rewardsCoordinator,
        address _delegationManager
    )
        ECDSAServiceManagerBase(
            _avsDirectory,
            _stakeRegistry,
            _rewardsCoordinator,
            _delegationManager
        )
    {}

    /* FUNCTIONS */

    function createNewTask(
        string memory name,
        uint256 goalAmount,
        uint256 duration
    ) external returns (uint32) {
        uint32 taskIndex = latestTaskNum;

        Task memory newCampaign = Task({
            name: name,
            taskCreatedBlock: uint32(block.number),
            goalAmount: goalAmount,
            fundsRaised: 0,
            deadline: block.timestamp + duration
        });

        allCampaigns[taskIndex] = newCampaign;
        allTaskHashes[taskIndex] = keccak256(abi.encode(newCampaign));
        
        emit NewTaskCreated(taskIndex, newCampaign);
        
        latestTaskNum += 1;
        return taskIndex;
    }

    function respondToTask(uint32 taskIndex, string memory message) external onlyOperator {
        Task storage task = allCampaigns[taskIndex];
        require(task.deadline > block.timestamp, "Task has expired");

        // Emit an event to log the response
        emit TaskResponded(taskIndex, task.name, msg.sender);
    }

    function donateToTask(uint32 campaignId) external payable {
        Task storage campaign = allCampaigns[campaignId];
        
        require(block.timestamp < campaign.deadline, "Campaign has ended");
        require(campaign.fundsRaised + msg.value <= campaign.goalAmount, "Campaign goal exceeded");

        campaign.fundsRaised += msg.value;
        allTaskResponses[msg.sender][campaignId] = abi.encodePacked(msg.value);

        emit DonationReceived(campaignId, msg.value, msg.sender);
    }

    function checkCampaignStatus(uint32 campaignId) external view returns (bool) {
        Task storage campaign = allCampaigns[campaignId];
        return campaign.fundsRaised >= campaign.goalAmount;
    }
}

import { ethers, parseEther, formatEther } from "ethers";
import * as dotenv from "dotenv";
import fs from 'fs';
import path from 'path';
dotenv.config();

if (!Object.keys(process.env).length) {
    throw new Error("process.env object is empty");
}

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
let chainId = 31337;

const avsDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/hello-world/${chainId}.json`), 'utf8'));
const coreDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/core/${chainId}.json`), 'utf8'));

const delegationManagerAddress = coreDeploymentData.addresses.delegation;
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;
const helloWorldServiceManagerAddress = avsDeploymentData.addresses.helloWorldServiceManager;
const ecdsaStakeRegistryAddress = avsDeploymentData.addresses.stakeRegistry;

// Load ABIs
const delegationManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IDelegationManager.json'), 'utf8'));
const ecdsaRegistryABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/ECDSAStakeRegistry.json'), 'utf8'));
const helloWorldServiceManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/CrowdFunding.json'), 'utf8'));
const avsDirectoryABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IAVSDirectory.json'), 'utf8'));

// Initialize contract objects from ABIs
const delegationManager = new ethers.Contract(delegationManagerAddress, delegationManagerABI, wallet);
const helloWorldServiceManager = new ethers.Contract(helloWorldServiceManagerAddress, helloWorldServiceManagerABI, wallet);
const ecdsaRegistryContract = new ethers.Contract(ecdsaStakeRegistryAddress, ecdsaRegistryABI, wallet);
const avsDirectory = new ethers.Contract(avsDirectoryAddress, avsDirectoryABI, wallet);

// Function to donate to a task (campaign)
const donateToTask = async (taskIndex: number, donationAmount: ethers.BigNumberish) => {
    try {
        console.log(`Donating ${formatEther(donationAmount)} ETH to task ${taskIndex}`);
        
        const tx = await helloWorldServiceManager.donateToTask(taskIndex, { value: donationAmount });
        await tx.wait();
        
        console.log(`Successfully donated to task ${taskIndex}`);
    } catch (error) {
        console.error(`Error donating to task ${taskIndex}:`, error);
    }
};

// Register operator to the EigenLayer
const registerOperator = async () => {
    try {
        const isOperatorRegistered = await delegationManager.isOperator(wallet.address);
        if (isOperatorRegistered) {
            console.log("Operator is already registered; skipping registration.");
            return;
        }

        const tx1 = await delegationManager.registerAsOperator({
            __deprecated_earningsReceiver: await wallet.getAddress(),
            delegationApprover: ethers.ZeroAddress,
            stakerOptOutWindowBlocks: 0
        }, "");
        await tx1.wait();
        console.log("Operator registered to Core EigenLayer contracts");
    } catch (error) {
        console.error("Error in registering as operator:", error);
        return;
    }

    const salt = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 3600;

    let operatorSignatureWithSaltAndExpiry = {
        signature: "",
        salt: salt,
        expiry: expiry
    };

    const operatorDigestHash = await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
        wallet.address,
        await helloWorldServiceManager.getAddress(),
        salt,
        expiry
    );

    console.log("Signing digest hash with operator's private key");
    const operatorSigningKey = new ethers.SigningKey(process.env.PRIVATE_KEY!);
    const operatorSignedDigestHash = operatorSigningKey.sign(operatorDigestHash);

    operatorSignatureWithSaltAndExpiry.signature = ethers.Signature.from(operatorSignedDigestHash).serialized;

    console.log("Registering Operator to AVS Registry contract");

    try {
        const tx2 = await ecdsaRegistryContract.registerOperatorWithSignature(
            operatorSignatureWithSaltAndExpiry,
            wallet.address
        );
        await tx2.wait();
        console.log("Operator registered on AVS successfully");
    } catch (error) {
        console.error("Error in AVS registration:", error);
    }
};

// Monitor for newly created tasks and automatically donate
const monitorNewTasks = async () => {
    helloWorldServiceManager.on("NewTaskCreated", async (taskIndex: number, task: any) => {
        console.log(`New task detected: ${task.name}`);
        
        const donationAmount = parseEther("0.1"); // Set donation amount (e.g., 0.1 ETH)
        await donateToTask(taskIndex, donationAmount);
    });

    console.log("Monitoring for new tasks...");
};

// Main function to execute operator registration and monitor tasks
const main = async () => {
    await registerOperator();
    monitorNewTasks().catch((error) => {
        console.error("Error monitoring tasks:", error);
    });
};

// Run the main function and handle errors
main().catch((error) => {
    console.error("Error in main function:", error);
});

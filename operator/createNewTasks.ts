import { ethers, parseEther, formatEther } from "ethers";
import * as dotenv from "dotenv";
const fs = require('fs');
const path = require('path');
dotenv.config();

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
let chainId = 31337;

const avsDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/hello-world/${chainId}.json`), 'utf8'));
const helloWorldServiceManagerAddress = avsDeploymentData.addresses.helloWorldServiceManager;
const helloWorldServiceManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/CrowdFunding.json'), 'utf8'));

// Initialize contract objects from ABIs
const helloWorldServiceManager = new ethers.Contract(helloWorldServiceManagerAddress, helloWorldServiceManagerABI, wallet);

// Function to generate random names
function generateRandomName(): string {
    const adjectives = ['Quick', 'Lazy', 'Sleepy', 'Noisy', 'Hungry'];
    const nouns = ['Fox', 'Dog', 'Cat', 'Mouse', 'Bear'];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomName = `${adjective}${noun}${Math.floor(Math.random() * 1000)}`;
    return randomName;
}

// Function to generate random goal amounts and duration
function generateRandomGoalAndDuration(): { goalAmount: ethers.BigNumberish, duration: number } {
    const randomGoalAmount = parseEther((Math.floor(Math.random() * 100 + 1)).toString()); // Goal amount in ETH
    const randomDuration = Math.floor(Math.random() * 30 + 1) * 86400; // Duration in seconds (1-30 days)
    return { goalAmount: randomGoalAmount, duration: randomDuration };
}

async function createNewTask(taskName: string) {
  try {
    const { goalAmount, duration } = generateRandomGoalAndDuration();

    // Send a transaction to the createNewTask function with name, goalAmount, and duration
    const tx = await helloWorldServiceManager.createNewTask(taskName, goalAmount, duration);
    
    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    
    // Parse events in the receipt to find NewTaskCreated
    const event = receipt.events?.find((event: any) => event.event === "NewTaskCreated");

    if (event) {
      const taskIndex = event.args?.taskIndex;
      console.log(`Transaction successful with hash: ${receipt.transactionHash}`);
      console.log(`Created task with index: ${taskIndex}, name: ${taskName}, goal amount: ${formatEther(goalAmount)} ETH, duration: ${duration / 86400} days`);
    } else {
      console.log("NewTaskCreated event not found in transaction receipt. Inspecting all events...");
      console.log(receipt.events); // Log all events to inspect what was emitted
    }
  } catch (error) {
    console.error('Error sending transaction:', error);
  }
}

// Function to create a new task with a random name, goal amount, and duration every 24 seconds
function startCreatingTasks() {
  setInterval(() => {
    const randomName = generateRandomName();
    console.log(`Creating new task with name: ${randomName}`);
    createNewTask(randomName);
  }, 24000);
}

// Start the process
startCreatingTasks();

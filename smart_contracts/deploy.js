import { network } from "hardhat";

async function main() {
    const machineAddress = process.env.RETURN_OPERATOR_ADDRESS;
    if (!machineAddress) {
        throw new Error("Missing RETURN_OPERATOR_ADDRESS in environment");
    }

    const { ethers, networkName } = await network.connect();

    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with ${deployer.address}`);

    const BottleDeposit = await ethers.getContractFactory("BottleDeposit");
    const contract = await BottleDeposit.deploy(deployer.address);

    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    console.log(`BottleDeposit deployed to ${contractAddress} (https://sepolia.etherscan.io/address/${contractAddress})`);

    console.log(`Authorizing machine ${machineAddress}...`);
    const tx = await contract.setReturnOperator(machineAddress, true);
    await tx.wait();
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
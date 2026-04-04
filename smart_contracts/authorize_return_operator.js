import { network } from "hardhat";

async function main() {
    const machineAddress = process.env.RETURN_OPERATOR_ADDRESS;
    if (!machineAddress) {
        throw new Error("Missing RETURN_OPERATOR_ADDRESS in environment");
    }
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
    if (!CONTRACT_ADDRESS) {
        throw new Error("Missing CONTRACT_ADDRESS in environment");
    }

    const { ethers } = await network.connect();
    const contract = await ethers.getContractAt("BottleDeposit", CONTRACT_ADDRESS);
    if (!contract) {
        throw new Error("Failed to get contract instance");
    }

    console.log(`Authorizing machine ${machineAddress}...`);
    const tx = await contract.setReturnOperator(machineAddress, true);
    await tx.wait();
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

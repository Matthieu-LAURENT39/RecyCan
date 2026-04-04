import { network } from "hardhat";

// Sample products to register after deployment.
// These are products available at the bars in the ETHGlobal venue.
const products = [
    // ===== Plastic bottles (0.0003 ETH) ===== 
    // Badoit 33cl water bottle
    { barcode: "3068320145105", depositWei: 300000000000000n },
    // Evian 33cl water bottle
    { barcode: "3068320124407", depositWei: 300000000000000n },
    // ===== Aluminum cans (0.0002 ETH) =====
    // Coca-Cola 33cl can
    { barcode: "5449000214911", depositWei: 200000000000000n },
    // Orangina 33cl can
    { barcode: "3124480184344", depositWei: 200000000000000n },
];

function hashBarcode(ethers, barcode) {
    return ethers.keccak256(ethers.toUtf8Bytes(barcode));
}

async function main() {
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
    if (!CONTRACT_ADDRESS) {
        throw new Error("Missing CONTRACT_ADDRESS in environment");
    }

    const { ethers } = await network.connect();
    const contract = await ethers.getContractAt("BottleDeposit", CONTRACT_ADDRESS);
    if (!contract) {
        throw new Error("Failed to get contract instance");
    }

    console.log("Registering products...");

    for (const product of products) {
        const barcodeHash = hashBarcode(ethers, product.barcode);
        const existing = await contract.products(barcodeHash);

        if (existing.depositWei !== 0n) {
            console.log(
                `Skipping ${product.barcode} -> ${barcodeHash} (already exists with deposit ${existing.depositWei})`
            );
            continue;
        }

        console.log(`Creating product ${product.barcode}...`);
        const tx = await contract.createProduct(barcodeHash, product.depositWei);
        await tx.wait();
        console.log(`Created ${product.barcode} -> ${barcodeHash}`);
    }

    console.log("Setup complete.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
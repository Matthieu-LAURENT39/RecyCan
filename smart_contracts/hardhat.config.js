import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

export default {
    plugins: [hardhatEthers],
    solidity: "0.8.24",
    networks: {
        sepolia: {
            type: "http",
            url: process.env.SEPOLIA_RPC_URL,
            accounts: [process.env.OWNER_PRIVATE_KEY],
        },
    },
};
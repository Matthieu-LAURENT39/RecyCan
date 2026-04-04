# Smart Contracts

## Deploy
**The project requires Node 22.**

Create a `.env` file based on the `.env.example` template, and fill in the required values.

Then, run the following command to deploy the contract to the Sepolia testnet:
```bash
npx hardhat run deploy.js --network sepolia
```

Finally, you can seed the contract with some products by using the `seed_products.js` script:
```bash
export CONTRACT_ADDRESS=the_address_of_your_deployed_contract
npx hardhat run seed_products.js --network sepolia
```
It is idempotent (it will skip existing entries), so you can run it multiple times without issues.
# Smart Contracts

## Installation
1. Make sure you have Node.js installed. Node 22 is required to run the scripts, and it is the only tested version.
2. In this directory (`smart_contracts`), run `npm install` to install the dependencies.
3. Create a `.env` file based on the `.env.example` template, and fill in the required values.

## Deploy
**Make sure you followed the steps in [the installation section](#installation) before running these commands.**

### 1. Deploying the smart contract
Run the following command to deploy the contract to the Sepolia testnet:
```bash
npx hardhat run deploy.js --network sepolia
```

### 2. Authorizing a return operator
Authorize a return operator (the address of the wallet used by the return machine) by using the `authorize_return_operator.js` script:
```bash
export CONTRACT_ADDRESS=the_address_of_your_deployed_contract
export RETURN_OPERATOR_ADDRESS=the_address_of_your_return_operator
npx hardhat run authorize_return_operator.js --network sepolia
```
You may authorize multiple return operators by running the script multiple times with different addresses.

### 3. Adding supported products
Add some products to the contract by using the `seed_products.js` script:
```bash
export CONTRACT_ADDRESS=the_address_of_your_deployed_contract
npx hardhat run seed_products.js --network sepolia
```
It is idempotent (it will skip existing entries), so you can run it multiple times without issues.  
You can also modify the `products` array in the script to add more products. The included products are products that are freely available at the ETHGlobal venue.  
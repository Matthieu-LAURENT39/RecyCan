# 🌱 RecyCan

**RecyCan : You Cannes Recycle It !**

RecyCan aims to prove that deposit return systems can be:
- More user-friendly
- Fully transparent
- Financially efficient

By leveraging blockchain, we can increase recycling participation and reduce environmental waste—without changing user habits, only improving the experience.

## Overview

RecyCan is a blockchain-powered solution designed to simplify and modernize bottle and can deposit return systems.

In many countries, deposit systems encourage recycling by requiring users to pay a small extra fee when purchasing bottled products. However, reclaiming this deposit is often inconvenient—users typically receive paper coupons instead of direct refunds, creating friction and reducing participation.

Recycan removes this friction by enabling a seamless, wallet-based experience:

Users pay deposits directly with their crypto wallet
Refunds are instantly sent back to their wallet upon return
No more paper coupons or locked value

The project demonstrates how blockchain can be integrated into real-world systems like cashier terminals and return machines using simple technologies such as QR codes and barcode scanning.

## Features
- Wallet-based deposit payments
- Instant on-chain refunds for returned bottles
- Camera-based barcode scanning (mocked cashier & return operating machines)
- QR code wallet identification
- Statistics dashboard (bottles sold, returned, deposits, etc.)
- Transparent and verifiable data via blockchain

## Use case
The following sequence diagrams illustrate the two main user flows of the application: purchasing a cans / bottles (buy) and returning it to reclaim the deposit.

### Purchaing items with a deposit
![image](sequence_diagrams/use_case_buy.png)

### Return items to redeem deposit 
![image](sequence_diagrams/use_case_return.png)

## Projet Structure 
The repository is divided into two main parts:

### Smart Contract
The folder ```smart_contracts/``` contains all blockchain-related logic.
- Smart contracts for tracking deposits and returns
- Barcode hashing for gas optimization
- Prevention of double spending via quantity tracking

More informations about how to set the project are available [here](smart_contracts/README.md)

### Frontend
The folder ```frontend``` contains the user interface built with Vite and JavaScript.
- Simulated cashier interface
- Simulated return operator interface
- Statistics dashboard
- Wallet connection via WalletConnect (AppKit + Reown Auth)

More informations about how to set the project are available [here](frontend/README.md)

## Tech Stack
- Smart Contracts: Solidity
- Development Framework: Hardhat (you can use Foundry if you prefer)
- Frontend: Vite + JavaScript
- Wallet Integration: WalletConnect (AppKit + Reown Auth)
- UX Simulation: Camera-based barcode and QR code scanning

Note :
- The project includes mocked data for the statistics dashboard, as generating real-world data was not feasible during the hackathon.
- The architecture is designed so that all statistics can be derived from on-chain data in a production environment.

## Future Improvements

Many things could be added if we had more time:
- Reward system for unclaimed deposits, with a lottery-style redistribution.
- Using WalletConnectPay to provide even more transparent and faster payment and refund.

## Use of AI

We leveraged AI tools throughout the project as a productivity enhancer, while keeping full control over the core logic and architecture.
- Frontend development assistance
AI was primarily used as a helper to speed up frontend development. Since frontend is not our main area of expertise, we relied on AI to generate small, well-scoped pieces of code (UI components, interactions, formatting, etc.). This allowed us to save time on repetitive or easily describable tasks, while still understanding and integrating everything ourselves.
- Documentation support
AI also helped us refine and structure parts of our functional documentation (project description, explanations, phrasing). As non-native English speakers, this was especially useful to ensure clarity, correctness, and professionalism in our communication.
- Core development ownership
The smart contract design, overall architecture, and integration of the main features were fully developed by us, using our own knowledge, online resources, and official documentation. AI was not used to design the system, but rather as a supporting tool to accelerate execution.
# Frontend

## Installation

You should have Node.js installed. Node 22 is the tested version.
You should install node packages with npm:
```npm install```

## Deploy
**Make sure you followed the steps in [the installation section](#installation) before running these commands.**

Run the app in development mode (localhost):
```npm run dev```

Build for production:
```npm run build```
This generates a ```dist/``` folder, which should be used as the deployment target in your hosting environment.

## Architecture
The frontend is built using Vite + JavaScript, with a focus on simplicity and fast iteration.

Blockchain interaction:
- Uses ethers.js to interact with smart contract.
- Handles deposit payments and refunds directly from the user's wallet.

Simulate:
- Html5Qrcode: scans wallet QR codes to retrieve user addresses during the deposit/return process
- BrowserMultiFormatReader: simulates barcode scanning for bottles and cans

These tools allow us to mimic real-world cashier and return machines using only a browser and a camera.

## Wallet Integration
Wallet connectivity is a central component of RecyCan. Our goal is to remove friction from existing deposit systems, and enabling seamless, flexible wallet access is key to achieving this.

We use WalletConnect, powered by AppKit and Reown Auth, to provide a unified and accessible authentication layer.

WalletConnect is a protocol that enables secure connections between applications and crypto wallets across devices. It allows users to connect using:
- Mobile wallets (via QR code)
- Browser wallets
- Multi-chain environments
This is essential for a real-world deployment where users may use different wallets and devices.

### AppKit
AppKit provides a modular SDK to integrate WalletConnect into applications.
Features:
- Multi-wallet compatibility: works with a wide range of wallets without custom integrations (perfect for a real-world large use case).
- QR code connection: user can log in using a QR code and the wallet on his phone (perfect for a self-checkout / machine interface).
- Quick integration: reduces development complexity while maintaining flexibility.

### Reown Auth
Reown Auth extends WalletConnect by enabling authentication without requiring an existing crypto wallet.
Features:
- Web2 onboarding: users can sign in using email or social accounts like X, Discord... (handly in real life environment).
- Automatic wallet creation: lowers the barrier to entry for non-crypto users (perfect to have new users in a large use case).
- SIWX (Sign In With X): a unified authentication layer bridging Web2 and Web3 identities.

Our project is focused on reducing user friction, and WalletConnect is key to making that possible. It enables a simple and intuitive QR code connection flow, perfectly suited for real-world interfaces like self-checkout or recycling machines. At the same time, it supports a wide range of wallets, making the solution scalable without locking users into a specific ecosystem. With Reown Auth, even non-crypto users can easily onboard using familiar methods like email or social login. Overall, it allows seamless integration into existing infrastructure while keeping the experience accessible and user-friendly.
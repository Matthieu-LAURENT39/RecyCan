pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * Contract implementing a simple deposit-return system.
 * - The owner registers valid products using a hashed barcode.
 * - Users buy refundable units of a product by sending the exact deposit amount.
 * - Return stations (that must be authorized) process returns.
 * - Refunds are sent back to the buyer wallet recorded in the contract state.
 * - We track refundable units per user and product to prevent abuse, making it impossible to return more units than bought.
 */
contract BottleDeposit is Ownable, ReentrancyGuard {
    /**
     * @notice Describes a bottle product that can participate in the deposit system.
     * @dev Products are keyed by the keccak256 hash of their barcode string. This choice
     *  was done for efficiency (fixed-size keys and no need for string comparison).
     */
    struct Product {
        /**
         * @notice Deposit amount required for one unit of this product, in wei.
         * This MUST NOT be zero for a valid product, as zero is used to indicate an unregistered product.
         */
        uint256 depositWei;
        /**
         * @notice Whether this product is currently retired and can no longer be bought.
         * Retired products can still be returned if they were bought while active, but new purchases are blocked.
         */
        bool retired;
    }

    /**
     * @notice Maps a barcode hash to its registered product data.
     */
    mapping(bytes32 => Product) public products;

    /**
     * @notice Tracks how many refundable units of a product a user currently owns.
     * @dev
     * - first key: user wallet address
     * - second key: barcode hash
     *
     * Example:
     * refundableUnits[user][barcodeHash] = 3
     * means the user can still claim refunds for 3 units of that product.
     */
    mapping(address => mapping(bytes32 => uint256)) public refundableUnits;

    /**
     * @notice Tracks which addresses are authorized to act as return machines/operators.
     * @dev Only addresses marked true can call returnBottleFor.
     */
    mapping(address => bool) public isReturnOperator;

    /**
     * @notice Thrown when a product does not exist in the registry.
     */
    error UnknownProduct();

    /**
     * @notice Thrown when attempting to buy a product that is retired.
     */
    error RetiredProduct();

    /**
     * @notice Thrown when the provided quantity is not strictly positive.
     */
    error InvalidQuantity();

    /**
     * @notice Thrown when the ETH sent with a buy transaction does not match the expected deposit 
            (Expected value is product.depositWei * quantity).
     */
    error WrongAmount();

    /**
     * @notice Thrown when a caller that is not an authorized return operator tries to process a return.
     */
    error NotReturnOperator();

    /**
     * @notice Thrown when a user does not have enough refundable units for the requested return.
     */
    error InsufficientUnits();

    /**
     * @notice Thrown when sending a refund to the user fails.
     */
    error RefundFailed();

    /**
     * @notice Thrown when the owner tries to register a product that already exists
     */
    error ProductAlreadyExists();

    // ===== Events =====
    // These can be used for showing a history of purchases and returns, great to show
    // analytics and tracking how much products are being returned.
    /**
     * @notice Emitted when a user buys refundable units for a product.
     * @param user The buyer's wallet address.
     * @param barcodeHash The keccak256 hash of the product barcode.
     * @param quantity The number of units purchased.
     * @param totalDeposit The total ETH deposited for this purchase, in wei.
     */
    event BottleBought(
        address indexed user,
        bytes32 indexed barcodeHash,
        uint256 quantity,
        uint256 totalDeposit
    );

    /**
     * @notice Emitted when an authorized operator processes a refund for a user.
     * @param operator The authorized return operator that processed the return.
     * @param user The user receiving the refund.
     * @param barcodeHash The keccak256 hash of the product barcode.
     * @param quantity The number of units returned.
     * @param totalRefund The total ETH refunded to the user, in wei.
     */
    event BottleReturned(
        address indexed operator,
        address indexed user,
        bytes32 indexed barcodeHash,
        uint256 quantity,
        uint256 totalRefund
    );

    /**
     * @notice Deploys the contract and sets the initial owner.
     * @param initialOwner The address that will receive owne permissions.
     * @dev The owner can register products and manage return operators.
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Registers a new product in the system.
     * @param barcodeHash The keccak256 hash of the product barcode.
     * @param depositWei The deposit amount required for one unit of this product, in wei. Must be greater than zero.
     * @dev The owner can call this function to add new products that users can buy and return.
     */
    function createProduct(
        bytes32 barcodeHash,
        uint256 depositWei
    ) external onlyOwner {
        if (depositWei == 0) revert WrongAmount();
        if (products[barcodeHash].depositWei != 0)
            revert ProductAlreadyExists();
        products[barcodeHash] = Product({
            depositWei: depositWei,
            retired: false
        });
    }

    /**
     * @notice Updates the retired status of a product.
     * @param barcodeHash The keccak256 hash of the product barcode.
     * @param retired Whether the product should be retired.
     */
    function setProductRetired(
        bytes32 barcodeHash,
        bool retired
    ) external onlyOwner {
        if (products[barcodeHash].depositWei == 0) revert UnknownProduct();
        products[barcodeHash].retired = retired;
    }

    /**
     * @notice Grants or revokes return-operator status for an address.
     * @param operator The address to authorize or deauthorize.
     * @param allowed True to authorize, false to revoke authorization.
     */
    function setReturnOperator(
        address operator,
        bool allowed
    ) external onlyOwner {
        isReturnOperator[operator] = allowed;
    }

    /**
     * @notice Buys refundable units of a product by paying the exact deposit amount.
     * @param barcodeHash The keccak256 hash of the product barcode being purchased.
     * @param quantity The number of units to buy.
     */
    function buyBottle(bytes32 barcodeHash, uint256 quantity) external payable {
        if (quantity == 0) revert InvalidQuantity();

        Product memory p = products[barcodeHash];
        if (p.depositWei == 0) revert UnknownProduct();
        if (p.retired) revert RetiredProduct();

        uint256 expected = p.depositWei * quantity;
        if (msg.value != expected) revert WrongAmount();

        refundableUnits[msg.sender][barcodeHash] += quantity;

        emit BottleBought(msg.sender, barcodeHash, quantity, expected);
    }

    /**
     * @notice Processes a return for a user and refunds their deposit.
     * @param user The buyer wallet that should receive the refund.
     * @param barcodeHash The keccak256 hash of the returned product barcode.
     * @param quantity The number of units being returned.
     */
    function returnBottle(
        address user,
        bytes32 barcodeHash,
        uint256 quantity
    ) external nonReentrant {
        if (!isReturnOperator[msg.sender]) revert NotReturnOperator();
        if (quantity <= 0) revert InvalidQuantity();

        Product memory p = products[barcodeHash];
        if (p.depositWei == 0) revert UnknownProduct();

        if (refundableUnits[user][barcodeHash] < quantity) {
            revert InsufficientUnits();
        }

        refundableUnits[user][barcodeHash] -= quantity;

        uint256 refund = p.depositWei * quantity;
        (bool ok, ) = payable(user).call{value: refund}("");
        if (!ok) revert RefundFailed();

        emit BottleReturned(msg.sender, user, barcodeHash, quantity, refund);
    }
}

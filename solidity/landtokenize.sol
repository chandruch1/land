// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LandFractionalizationSystem {
    // Token details
    string public name = "LandToken";
    string public symbol = "LAND";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    // Admin address explicitly set
    address public owner = 0xC87dAE04cC23b8C078acE5E30F5B2575535a50B0;

    IERC20 public landToken = IERC20(0x2089cb616333462e0987105f137DD8Af2C190957);

    mapping(address => bool) private _locked;

    uint256 public constant UNITS_PER_ACRE = 43560;

    uint256 public platformFeePercentage = 250; // 2.5%

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(uint256 => uint256)) public userLandHoldings;

    struct LandParcel {
        uint256 id;
        string location;
        uint256 totalAcres;
        uint256 totalUnits;
        bool isActive;
        string metadataURI;
        uint256 createdAt;
    }

    mapping(uint256 => LandParcel) public landParcels;
    uint256 public totalLandParcels;

    struct Sale {
        uint256 id;
        address seller;
        uint256 landId;
        uint256 unitsForSale;
        uint256 pricePerUnit; // price in LAND tokens per unit
        bool isActive;
        uint256 timestamp;
    }

    mapping(uint256 => Sale) public sales;
    mapping(address => uint256[]) public userSales;
    uint256 public totalSales;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event LandTokenized(uint256 indexed landId, string location, uint256 acres, uint256 totalUnits);
    event LandPurchased(address indexed buyer, uint256 indexed landId, uint256 units, uint256 totalCost);
    event LandListed(uint256 indexed saleId, address indexed seller, uint256 indexed landId, uint256 units, uint256 price);
    event LandTraded(uint256 indexed saleId, address indexed buyer, address indexed seller, uint256 units, uint256 totalCost);
    event SaleCancelled(uint256 indexed saleId);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    modifier nonReentrant() {
        require(!_locked[msg.sender], "ReentrancyGuard: reentrant call");
        _locked[msg.sender] = true;
        _;
        _locked[msg.sender] = false;
    }

    // ===========================================
    // Admin functions
    // ===========================================

    function tokenizeLand(
        string memory _location,
        uint256 _acres,
        string memory _metadataURI
    ) external onlyOwner {
        require(_acres > 0, "Acres must be greater than 0");
        require(bytes(_location).length > 0, "Location required");

        totalLandParcels++;
        uint256 totalUnits = _acres * UNITS_PER_ACRE;

        landParcels[totalLandParcels] = LandParcel({
            id: totalLandParcels,
            location: _location,
            totalAcres: _acres,
            totalUnits: totalUnits,
            isActive: true,
            metadataURI: _metadataURI,
            createdAt: block.timestamp
        });

        // Mint land tokens to owner by increasing internal balance mapping
        balanceOf[owner] += totalUnits;
        totalSupply += totalUnits;

        emit LandTokenized(totalLandParcels, _location, _acres, totalUnits);
        emit Transfer(address(0), owner, totalUnits);
    }

    function setPlatformFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1000, "Fee too high"); // Max 10%
        platformFeePercentage = _feePercentage;
    }

    function setLandStatus(uint256 _landId, bool _isActive) external onlyOwner {
        require(_landId > 0 && _landId <= totalLandParcels, "Invalid land ID");
        landParcels[_landId].isActive = _isActive;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    // ===========================================
    // User functions - buy from admin
    // ===========================================

    function buyFromAdmin(uint256 _landId, uint256 _units) external nonReentrant {
        require(_landId > 0 && _landId <= totalLandParcels, "Invalid land ID");
        require(_units > 0, "Invalid units");

        LandParcel memory land = landParcels[_landId];
        require(land.isActive, "Land not available");
        require(balanceOf[owner] >= _units, "Insufficient supply");

        uint256 totalCost = _units * (10 ** decimals); // Price in LAND tokens (1 token per unit)

        // Buyer must approve contract to spend LAND tokens
        require(landToken.allowance(msg.sender, address(this)) >= totalCost, "Token allowance too low");
        require(landToken.balanceOf(msg.sender) >= totalCost, "Insufficient token balance");

        // Calculate platform fee
        uint256 platformFee = (totalCost * platformFeePercentage) / 10000;
        uint256 adminAmount = totalCost - platformFee;

        // Transfer payment LAND tokens from buyer to owner
        require(landToken.transferFrom(msg.sender, owner, adminAmount), "Payment to owner failed");
        // Transfer platform fee to contract itself
        require(landToken.transferFrom(msg.sender, address(this), platformFee), "Fee transfer failed");

        // Transfer land fractional tokens inside system (internal balances)
        balanceOf[owner] -= _units;
        balanceOf[msg.sender] += _units;
        userLandHoldings[msg.sender][_landId] += _units;

        emit Transfer(owner, msg.sender, _units);
        emit LandPurchased(msg.sender, _landId, _units, totalCost);
    }

    // ===========================================
    // User functions - peer to peer trading
    // ===========================================

    function listForSale(uint256 _landId, uint256 _units, uint256 _pricePerUnit) external {
        require(_landId > 0 && _landId <= totalLandParcels, "Invalid land ID");
        require(_units > 0, "Invalid units");
        require(_pricePerUnit > 0, "Invalid price");
        require(balanceOf[msg.sender] >= _units, "Insufficient balance");
        require(userLandHoldings[msg.sender][_landId] >= _units, "Insufficient land tokens");

        totalSales++;

        sales[totalSales] = Sale({
            id: totalSales,
            seller: msg.sender,
            landId: _landId,
            unitsForSale: _units,
            pricePerUnit: _pricePerUnit,
            isActive: true,
            timestamp: block.timestamp
        });

        userSales[msg.sender].push(totalSales);

        // Lock tokens in contract
        balanceOf[msg.sender] -= _units;
        balanceOf[address(this)] += _units;
        userLandHoldings[msg.sender][_landId] -= _units;

        emit Transfer(msg.sender, address(this), _units);
        emit LandListed(totalSales, msg.sender, _landId, _units, _pricePerUnit);
    }

    function buyFromUser(uint256 _saleId, uint256 _units) external nonReentrant {
        require(_saleId > 0 && _saleId <= totalSales, "Invalid sale ID");
        require(_units > 0, "Invalid units");

        Sale storage sale = sales[_saleId];
        require(sale.isActive, "Sale not active");
        require(sale.seller != msg.sender, "Cannot buy from yourself");
        require(_units <= sale.unitsForSale, "Not enough units");

        uint256 totalCost = _units * sale.pricePerUnit;

        // Buyer must approve contract to spend LAND tokens
        require(landToken.allowance(msg.sender, address(this)) >= totalCost, "Token allowance too low");
        require(landToken.balanceOf(msg.sender) >= totalCost, "Insufficient token balance");

        // Calculate platform fee
        uint256 platformFee = (totalCost * platformFeePercentage) / 10000;
        uint256 sellerAmount = totalCost - platformFee;

        // Transfer payment LAND tokens
        require(landToken.transferFrom(msg.sender, sale.seller, sellerAmount), "Payment to seller failed");
        require(landToken.transferFrom(msg.sender, address(this), platformFee), "Fee transfer failed");

        // Transfer locked land tokens from contract to buyer
        balanceOf[address(this)] -= _units;
        balanceOf[msg.sender] += _units;
        userLandHoldings[msg.sender][sale.landId] += _units;

        // Update sale status
        sale.unitsForSale -= _units;
        if (sale.unitsForSale == 0) {
            sale.isActive = false;
        }

        emit Transfer(address(this), msg.sender, _units);
        emit LandTraded(_saleId, msg.sender, sale.seller, _units, totalCost);
    }

    // Cancel sale listing
    function cancelSale(uint256 _saleId) external {
        require(_saleId > 0 && _saleId <= totalSales, "Invalid sale ID");

        Sale storage sale = sales[_saleId];
        require(sale.seller == msg.sender, "Only seller can cancel");
        require(sale.isActive, "Sale not active");

        // Return tokens to seller
        balanceOf[address(this)] -= sale.unitsForSale;
        balanceOf[sale.seller] += sale.unitsForSale;
        userLandHoldings[sale.seller][sale.landId] += sale.unitsForSale;

        sale.isActive = false;

        emit Transfer(address(this), sale.seller, sale.unitsForSale);
        emit SaleCancelled(_saleId);
    }

    // Withdraw accumulated platform fees in LAND tokens by owner
    function withdrawFees() external onlyOwner {
        uint256 balance = landToken.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");

        require(landToken.transfer(owner, balance), "Fee withdrawal failed");
    }

    // Additional helper/view functions not modified for brevity...

    // Allow contract to receive ETH (just in case)
    receive() external payable {}
    fallback() external payable {}
}

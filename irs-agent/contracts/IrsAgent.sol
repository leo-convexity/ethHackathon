// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ~0.8.4;

import "OpenZeppelin/openzeppelin-contracts@4.1.0/contracts/access/Ownable.sol";
import "OpenZeppelin/openzeppelin-contracts@4.1.0/contracts/token/ERC20/IERC20.sol";
import "contracts/CompoundInterface.sol";

error NoFallback();
error NoReceive();
error BadToken();

contract IrsAgent is Ownable {
    event Deposit(
	address indexed _from,
	address _deposited_token,
	uint _deposited_value,
	uint _reserve_value,
	uint _rate
    );

    event Withdrawal(
	address indexed _from,
	address _withdrawn_token,
	uint _withdrawn_value,
	uint _reserve_value,
	uint _rate
    );

    event Settle(
	uint _rate
    );

    struct Entry {
	uint balance;
	int size;
	uint price;
    }

    int constant public MARGIN_RATE_MUL = 1;
    int constant public MARGIN_RATE_DIV = 20;

    IERC20 public token;
    CErc20 public ctoken;
    uint public expiry_block;
    uint public depositors;
    uint public fixing;
    uint public fixing_block;

    mapping (address => Entry) public entries;

    uint public m_bid_price;
    uint public m_bid_size;
    uint public m_ask_price;
    uint public m_ask_size;
    uint public m_pos_sold;
    uint public m_val_sold;
    uint public m_pos_bought;
    uint public m_val_bought;
    uint public m_deposited;
    uint public m_withdrawn;
    int public m_pnl_depositors;

    constructor(CErc20 _ctoken, uint _expiry_block) {
	require(address(_ctoken) != address(0), "ctoken cannot be null");
	require(_expiry_block > block.number, "expiry block must be in future");
	IERC20 _token = IERC20(_ctoken.underlying());
	ctoken = _ctoken;
	token = _token;
	expiry_block = _expiry_block;

	address _owner = owner();
	require(_token.approve(_owner, ~uint(0)), "approve failure");
	require(_ctoken.approve(_owner, ~uint(0)), "approve failure");
    }

    //
    // public state changing methods
    //

    fallback (bytes calldata /*_input*/) external payable returns (bytes memory /*_output*/) {
	revert NoFallback();
    }

    receive() external payable {
	revert NoReceive();
    }

    function deposit(uint amount, address token_) external {
	return _deposit(amount, token_);
    }

    function withdraw(uint amount, address token_) external {
	return _withdraw(amount, token_);
    }

    function withdrawWrapped(uint amount) external {
	return _withdrawWrapped(amount);
    }

    function expire() external returns (bool) {
	return _expire();
    }

    function openShort(uint size, uint limit) external {
	return _openShort(size, limit);
    }

    function closeShort(uint size, uint limit) external {
	return _closeShort(size, limit);
    }

    function settle() external {
	return _settle();
    }

    function setQuote(uint bid_price, uint bid_size, uint ask_price, uint ask_size) public onlyOwner {
	require(bid_size == 0 || ask_size == 0 || ask_price >= bid_price, "ask less than bid");
	if (bid_size == 0 && ask_size == 0) {
	    m_bid_price = m_bid_size = m_ask_price = m_ask_size = 0;
	    return;
	}
	uint rate = ctoken.exchangeRateCurrent();
	if (bid_size == 0) {
	    m_bid_price = m_bid_size = 0;
	} else {
	    require(bid_price >= rate, "bid less than spot");
	    m_bid_price = bid_price;
	    m_bid_size = bid_size;
	}
	if (ask_size == 0) {
	    m_ask_price = m_ask_size = 0;
	} else {
	    require(ask_price >= rate, "ask less than spot");
	    m_ask_price = ask_price;
	    m_ask_size = ask_size;
	}
    }

    function setQuoteSize(uint bid_size, uint ask_size, uint current_bid_size, uint current_ask_size) public onlyOwner {
	uint new_bid_size = bid_size;
	uint new_ask_size = ask_size;

	if (m_bid_size < current_bid_size) {
	    uint bid_size_reduction = current_bid_size - m_bid_size;
	    if (new_bid_size <= bid_size_reduction)
		new_bid_size = 0;
	    else
		new_bid_size -= bid_size_reduction;
	}

	if (m_ask_size < current_ask_size) {
	    uint ask_size_reduction = current_ask_size - m_ask_size;
	    if (new_ask_size <= ask_size_reduction)
		new_ask_size = 0;
	    else
		new_ask_size -= ask_size_reduction;
	}

	m_bid_size = new_bid_size;
	m_ask_size = new_ask_size;
    }

    //
    // public read only methods
    //

    function balanceOf(address depositor) external view returns (uint) {
	return entries[depositor].balance;
    }

    function reserves() external view returns (uint) {
	return token.balanceOf(address(this));
    }

    function blocksToExpiry() public returns (uint) {
	uint expiry_block_ = expiry_block;
	if (block.number < expiry_block_)
	    return expiry_block_ - block.number;
	else
	    return 0;
    }

    function fairValue() public returns (uint) {
	if (fixing_block != 0 && block.number >= fixing_block)
	    return fixing;

	uint rate = ctoken.exchangeRateCurrent();
	uint blocks_to_expiry = blocksToExpiry();
 	uint supply_rate = ctoken.supplyRatePerBlock();
	rate += rate * supply_rate * blocks_to_expiry / 1_000_000_000_000_000_000;

	return rate;
    }

    function bidPrice() external returns (uint) {
	return m_bid_price;
    }

    function bidSize() external returns (uint) {
	return m_bid_size;
    }

    function askPrice() external returns (uint) {
	return m_ask_price;
    }

    function askSize() external returns (uint) {
	return m_ask_size;
    }

    function fullQuote() external returns (uint, uint, uint, uint) {
	return (m_bid_price, m_bid_size, m_ask_price, m_ask_size);
    }

   function requiredMargin(Entry memory entry, uint mark, uint rate) pure external returns (uint) {
      return _requiredMargin(entry, mark, rate);
   }

    //
    // implementation methods
    //

    function _requiredMargin(Entry memory entry, uint mark, uint rate) pure internal returns (uint) {
	if (entry.size == 0) return 0;
	require(entry.price > 0, "price cannot be zero");
	require(mark > 0, "mark cannot be zero");
	int size_ = entry.size;
	int mark_ = int(mark);
	int abs_size_ = size_ < 0 ? -size_ : size_;
	int margin = abs_size_ * mark_ * MARGIN_RATE_MUL / MARGIN_RATE_DIV / int(rate);
	int neg_pnl = (int(entry.price) - mark_) * size_ / int(rate);
	margin += neg_pnl;
	if (margin < 0)
	    margin = 0;
	return uint(margin);
    }

    function _deposit(uint amount, address _token) internal {
	require(amount > 0, "deposit:0");
	address msgSender = _msgSender();
	uint deposit_amount = amount;

	if (_token == address(token)) {
	    require(token.transferFrom(msgSender, address(this), amount), "deposit:1");
	    uint balance_before = ctoken.balanceOf(address(this));
	    require(token.approve(address(ctoken), amount), "deposit:2");
	    {
	        uint rc = ctoken.mint(amount);
		if (rc != 0) {
		    bytes memory text = "deposit:3:\x00";
		    text[10] = bytes1(64 + (uint8(rc) & 0x1f));
		    revert(string(text));
		}
	    }
	    uint balance_after = ctoken.balanceOf(address(this));
	    uint minted = balance_after - balance_before;
	    require(minted > 0, "deposit:4");
	    amount = minted;
	} else if (_token == address(ctoken)) {
	    require(ctoken.transferFrom(msgSender, address(this), amount), "deposit:5");
	} else {
	    revert BadToken();
	}

	uint old_balance = entries[msgSender].balance;
	if (old_balance == 0)
	    ++depositors;
	entries[msgSender].balance = old_balance + amount;
	m_deposited += amount;

	uint rate = ctoken.exchangeRateCurrent();

	emit Deposit(msgSender, _token, deposit_amount, amount, rate);
    }

    function _openShort(uint size, uint limit) internal {
	address msgSender = _msgSender();
	require(block.number < expiry_block, "past expiry");
	require(size > 0, "size must be greater than zero");
	require(limit > 0, "limit price must be greater than zero");

	Entry memory entry = entries[msgSender];
	require(entry.size == 0, "position already open");

	require(size <= m_bid_size, "insufficient size available");
	entry.size = -int(size);
	require(entry.size < 0, "overflow");

	require(limit <= m_bid_price, "limit price not matched");
	entry.price = m_bid_price;

	uint rate = ctoken.exchangeRateCurrent();
	require(entry.balance >= _requiredMargin(entry, fairValue(), rate), "insufficient margin");

	m_bid_size -= size;
	m_pos_sold += size;
	m_val_sold += size * m_bid_price;
	entries[msgSender] = entry;
    }

    function _closeShort(uint size, uint limit) internal {
	address msgSender = _msgSender();
	require(block.number < expiry_block, "past expiry");
	int ssize_ = int(size);
	require(ssize_ > 0, "size must be greater than zero");
	require(limit > 0, "limit price must be greater than zero");

	Entry memory entry = entries[msgSender];
	require(entry.size < 0, "no short position to close");
	if (ssize_ + entry.size > 0)
	    ssize_ = -entry.size;

	require(uint(ssize_) <= m_ask_size, "insufficient size available");

	require(limit >= m_ask_price, "limit price not matched");

	uint rate = ctoken.exchangeRateCurrent();
	int pnl = (int(entry.price) - int(m_ask_price)) * ssize_ / int(rate);

	if (pnl < 0)
	    entry.balance -= uint(-pnl);
	else
	    entry.balance += uint(pnl);
	entry.size += ssize_;
	if (entry.size == 0)
	    entry.price = 0;

	require(entry.balance >= _requiredMargin(entry, fairValue(), rate), "insufficient margin");

	m_pnl_depositors += pnl;
	m_ask_size -= uint(ssize_);
	m_pos_bought += uint(ssize_);
	m_val_bought += uint(ssize_) * m_ask_price;
	entries[msgSender] = entry;
    }

    function _settle() internal {
	require(fixing_block > 0);
	require(fixing > 0);
	address msgSender = _msgSender();

	Entry memory entry = entries[msgSender];
	if (entry.size == 0)
	    return;

	require(entry.size < 0, "no short position to settle");

	int pnl = entry.size * int(entry.price) / int(fixing) - entry.size;

	if (pnl < 0)
	    entry.balance -= uint(-pnl);
	else
	    entry.balance += uint(pnl);

	m_pnl_depositors += pnl;
	m_ask_size -= uint(entry.size);
	m_pos_bought += uint(entry.size);
	m_val_bought += uint(entry.size) * fixing;

	entry.size = 0;
	entry.price = 0;

	entries[msgSender] = entry;
    }

    function _withdraw(uint amount, address _token) internal {
	require(amount > 0);
	address msgSender = _msgSender();

	uint ctoken_balance_before = ctoken.balanceOf(address(this));
	uint token_balance_before = token.balanceOf(address(this));

	if (_token == address(token)) {
	    require(ctoken.redeemUnderlying(amount) == 0);
	} else if (_token == address(ctoken)) {
	    require(ctoken.redeem(amount) == 0);
	} else {
	    revert BadToken();
	}

	uint ctoken_balance_decrease = ctoken_balance_before - ctoken.balanceOf(address(this));
	uint token_balance_increase = token.balanceOf(address(this)) - token_balance_before;

	Entry memory entry = entries[msgSender];
	uint new_balance = entry.balance - ctoken_balance_decrease; // solidity v0.8.0+ should catch underflows
	uint rate = ctoken.exchangeRateCurrent();
	require(new_balance >= _requiredMargin(entry, fairValue(), rate), "insufficient margin");

	require(token.transfer(msgSender, token_balance_increase), "transfer out failed");
	entries[msgSender].balance = new_balance;
	m_withdrawn += ctoken_balance_decrease;
	if (new_balance == 0)
	    --depositors;

	emit Withdrawal(msgSender, _token, amount, ctoken_balance_decrease, rate);
    }

    function _withdrawWrapped(uint amount) internal {
	require(amount > 0);
	address msgSender = _msgSender();
	CErc20 ctoken_ = ctoken;
	uint ctoken_balance_decrease = amount;

	Entry memory entry = entries[msgSender];
	uint new_balance = entry.balance - ctoken_balance_decrease; // solidity v0.8.0+ should catch underflows
	uint rate = ctoken_.exchangeRateCurrent();
	require(new_balance >= _requiredMargin(entry, fairValue(), rate), "insufficient margin");

	require(token.transfer(msgSender, ctoken_balance_decrease), "transfer out failed");
	entries[msgSender].balance = new_balance;
	m_withdrawn += ctoken_balance_decrease;
	if (new_balance == 0)
	    --depositors;

	emit Withdrawal(msgSender, address(ctoken_), amount, ctoken_balance_decrease, rate);
    }

    function _expire() internal returns (bool) {
	if (block.number < expiry_block)
	    return false;

	if (fixing_block == 0) {
	    uint rate = ctoken.exchangeRateCurrent();
	    fixing = rate;
	    fixing_block = block.number;
	    require(rate > 0, "fixing cannot be zero");
	    emit Settle(rate);
	}

	return true;
    }
}

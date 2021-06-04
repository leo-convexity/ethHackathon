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

    IERC20 public token;
    CErc20 public ctoken;
    uint public expiry;
    uint public depositors;
    mapping (address => uint) private balances;

    constructor(CErc20 _ctoken, IERC20 _token, uint _expiry) {
        require(address(_token) != address(0));
        require(_expiry > block.number);
        ctoken = _ctoken;
        token = _token;
        expiry = _expiry;
    }

    function deposit(uint amount, address _token) external {
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

        uint old_balance = balances[msgSender];
        if (old_balance == 0)
            ++depositors;
        balances[msgSender] = old_balance + amount;

        uint rate = ctoken.exchangeRateCurrent();

        emit Deposit(msgSender, _token, deposit_amount, amount, rate);
    }

    function withdraw(uint amount, address _token) external {
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

        uint ctoken_balance_after = ctoken.balanceOf(address(this));
        uint token_balance_after = token.balanceOf(address(this));

        uint ctoken_balance_decrease = ctoken_balance_before - ctoken_balance_after;
        uint token_balance_increase = token_balance_after - token_balance_before;

        uint new_balance = balances[msgSender] - ctoken_balance_decrease; // solidity v0.8.0+ should catch underflows
        if (token.transfer(msgSender, token_balance_increase)) {
            balances[msgSender] = new_balance;
            if (new_balance == 0)
                --depositors;
        }

        uint rate = ctoken.exchangeRateCurrent();

        emit Withdrawal(msgSender, _token, amount, ctoken_balance_decrease, rate);
    }

    function depositOld(uint amount) external {
        require(amount > 0);
        address msgSender = _msgSender();
        if (token.transferFrom(msgSender, address(this), amount)) {
            uint old_balance = balances[msgSender];
            if (old_balance == 0)
                ++depositors;
            balances[msgSender] = old_balance + amount;
        }
    }

    function withdrawOld(uint amount) external {
        require(amount > 0);
        address msgSender = _msgSender();
        uint new_balance = balances[msgSender] - amount; // solidity v0.8.0+ should catch underflows
        if (token.transfer(msgSender, amount)) {
            balances[msgSender] = new_balance;
            if (new_balance == 0)
                --depositors;
        }
    }

    function balanceOf(address depositor) external view returns (uint) {
        return balances[depositor];
    }

    function reserves() external view returns (uint) {
        return IERC20(token).balanceOf(address(this));
    }

    fallback (bytes calldata /*_input*/) external payable returns (bytes memory /*_output*/) {
        revert NoFallback();
    }

    receive() external payable {
        revert NoReceive();
    }
}

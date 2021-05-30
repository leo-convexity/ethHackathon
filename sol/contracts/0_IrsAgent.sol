// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity >=0.8.0 <0.9.0;

import "http://github.com/OpenZeppelin/openzeppelin-solidity/contracts/access/Ownable.sol"; 
import "http://github.com/OpenZeppelin/openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

error NoFallback();
error NoReceive();

contract IrsAgent is Ownable {
    IERC20 public token;
    mapping (address => uint) private balances;
    uint public depositors;

    constructor(IERC20 _token) {
        require(address(_token) != address(0));
        token = _token;
    }

    function deposit(uint amount) external {
        require(amount > 0);
        address msgSender = _msgSender();
        if (token.transferFrom(msgSender, address(this), amount)) {
            uint old_balance = balances[msgSender];
            if (old_balance == 0)
                ++depositors;
            balances[msgSender] = old_balance + amount;
        }
    }

    function withdraw(uint amount) external {
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

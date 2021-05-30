const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:8545');

// Your Ethereum wallet private key
const privateKey = 'b8c1b5c1d81f9475fdf2e334517d29f733bdfa40682207571b12fc1142cbf329';

// Add your Ethereum wallet to the Web3 object
web3.eth.accounts.wallet.add('0x' + privateKey);
const myWalletAddress = web3.eth.accounts.wallet[0].address;

// Web3 transaction information, we'll use this for every transaction we'll send
const fromMyWallet = {
  from: myWalletAddress,
  gasLimit: web3.utils.toHex(500000),
  gasPrice: web3.utils.toHex(20000000000) // use ethgasstation.info (mainnet only)
};

// Mainnet Contract for cDAI (https://compound.finance/docs#networks)
const cTokenContractAddress = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643';
const cTokenAbiJson = 
const underlyingContract = new web3.eth.Contract(erc20AbiJson, underlyingContractAddress);

const assetName = 'DAI'; // for the log output lines
const underlyingDecimals = 18; // Number of decimals defined in this ERC20 token's contract

const main = async function() {
  // 10 tokens
  const underlyingTokensToSupply = 10 * Math.pow(10, underlyingDecimals);

  // Tell the contract to allow 10 tokens to be taken by the cToken contract
  await underlyingContract.methods.approve(
    cTokenContractAddress, web3.utils.toBN(underlyingTokensToSupply)
  ).send(fromMyWallet);

  

  // Mint cTokens by supplying underlying tokens to the Compound Protocol
  await cTokenContract.methods.mint(
    web3.utils.toBN(underlyingTokensToSupply.toString())
  ).send(fromMyWallet);

  console.log(`c${assetName} "Mint" operation successful.`, '\n');

  const balanceOfUnderlying = web3.utils.toBN(await cTokenContract.methods
    .balanceOfUnderlying(myWalletAddress).call()) / Math.pow(10, underlyingDecimals);

  console.log(`${assetName} supplied to the Compound Protocol:`, balanceOfUnderlying, '\n');

  let cTokenBalance = await cTokenContract.methods.balanceOf(myWalletAddress).call() / 1e8;
  console.log(`My wallet's c${assetName} Token Balance:`, cTokenBalance);

  let underlyingBalance = await underlyingContract.methods.balanceOf(myWalletAddress).call();
  underlyingBalance = underlyingBalance / Math.pow(10, underlyingDecimals);
  console.log(`My wallet's ${assetName} Token Balance:`, underlyingBalance, '\n');

  let erCurrent = await cTokenContract.methods.exchangeRateCurrent().call();
  let exchangeRate = erCurrent / Math.pow(10, 18 + underlyingDecimals - 8);
  console.log(`Current exchange rate from c${assetName} to ${assetName}:`, exchangeRate, '\n');

  console.log(`Redeeming the c${assetName} for ${assetName}...`);

  // redeem (based on cTokens)
  console.log(`Exchanging all c${assetName} based on cToken amount...`, '\n');
  await cTokenContract.methods.redeem(cTokenBalance * 1e8).send(fromMyWallet);

  // redeem (based on underlying)
  // console.log(`Exchanging all c${assetName} based on underlying ${assetName} amount...`);
  // let underlyingAmount = balanceOfUnderlying * Math.pow(10, underlyingDecimals);
  // await cTokenContract.methods.redeemUnderlying(underlyingAmount).send(fromMyWallet);

  cTokenBalance = await cTokenContract.methods.balanceOf(myWalletAddress).call();
  cTokenBalance = cTokenBalance / 1e8;
  console.log(`My wallet's c${assetName} Token Balance:`, cTokenBalance);

  underlyingBalance = await underlyingContract.methods.balanceOf(myWalletAddress).call();
  underlyingBalance = underlyingBalance / Math.pow(10, underlyingDecimals);
  console.log(`My wallet's ${assetName} Token Balance:`, underlyingBalance, '\n');
}

main().catch((err) => {
  console.error(err);
});
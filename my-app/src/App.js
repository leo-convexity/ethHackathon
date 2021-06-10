import style from './App.css';
import React, { Component , useState } from 'react';
import { render } from 'react-dom';
import BigNumber from 'bignumber.js';
import logo from './1.png';

//copy pasted the config file from api-guide-example 
const config = require('./config_mainnet.json');
const irsConfig = require('./deployed_irs_agent.json'); //gets the deployed_irs_agent.json file
const Web3 = require('web3' || "http://127.0.0.1:8545");

//changed to givenProvider to see if we can work with MetaMask
const web3 = new Web3(Web3.givenProvider);
const ethereum = window.ethereum;

//here are the cUSDC address and ABI
const cUsdcAddress = config.cUsdcAddress;
const cUsdcAbi = config.cUsdcAbi;
const cUsdcContract = new web3.eth.Contract(cUsdcAbi, cUsdcAddress);

//here we build the USDC contract and ABI
const usdcAddress = config.usdcAddress;
const usdcAbi = config.usdcAbi;
const usdcContract = new web3.eth.Contract(usdcAbi, usdcAddress);

//build the deployed_irs_agent contract from address and ABI
const irsAgentAddress = irsConfig[0].contract_address;
const irsAgentAbi = irsConfig[0].abi;
const irsAgentContract = new web3.eth.Contract(irsAgentAbi, irsAgentAddress);

const owner = "0xbcd4042de499d14e55001ccbb24a551f3b954096"; //owner of the Contract is also the market maker
const expiryDateObject = new Date('June 5 2022');
const today = new Date();
const msPerYear = 24 * 60 * 60 * 1000 *365; // Number of milliseconds per year
const decimals = {usdc : 6, cusdc: 8, cusdcRate : 16};
const scaler = {usdc : Math.pow(10, decimals.usdc), cusdc : Math.pow(10, decimals.cusdc), cusdcRate : Math.pow(10,decimals.cusdcRate) }
const cTokenFuturePriceManual = 0.0238;

//add this to the end of contract calls
const hash = function(err, res){
  if(err) {
    console.log("An Error Occured", err);
    return
  }
  console.log("hash of transaction: "+ res);
}

//returns the current exchange rate from cUSDC contract
async function xr () {
  const xr = await cUsdcContract.methods.exchangeRateCurrent().call()/scaler.cusdcRate;
  return xr
}    

//returns the expiry block from the irsAgent contract
async function xblck () {
  const xblck = await irsAgentContract.methods.blocksToExpiry().call();
  return xblck;
}    

//returns the current block number
async function cblck () {
  const cblck = await web3.eth.getBlockNumber();
  return cblck;
}    

//returns the future bid price scaled
async function fp (){
    const fp = await irsAgentContract.methods.bidPrice().call()/scaler.cusdcRate;
    return fp;
}

//returns the future bid size scaled
async function fs (){
    const fs = await irsAgentContract.methods.bidSize().call()/scaler.cusdc;
    return fs;
}

//returns the account position
async function getEntries (x) {
   const entries = await irsAgentContract.methods.entries(x).call();
   return entries;
}

var myWalletAddress = null;
class Ticker extends Component{

  componentDidMount(){
    this.loadBlockchainData()
  }
  //load current blockchain data - what is the current exchange rate?
  //what is the cToken future price exchange rate?
  async loadBlockchainData () {    
    //what is the current cToken exchange rate?
    const exchangeRateCurrent = await xr();
    this.setState({ exchangeRateCurrent});

    //date should come from the IRS Agent smart contract, but using a hardcode for now
    //how many blocks until expiry?
    const blocksToExpiry = await xblck();
    this.setState({blocksToExpiry});
    const currentBlock = await cblck();
    this.setState({currentBlock});

    //time left in milliseconds until expiry assuming 13 seconds per block
    const timeLeft = blocksToExpiry * 13 * 1000
    var xpt = new Date(Date.now() + timeLeft);
    console.log("expiry date is : " + xpt);

    const expiryDate = xpt.toString();
    this.setState({expiryDate});
    const dayCount = timeLeft/msPerYear;

    //creating variables that will later reference the blockchain - will need to make this so it somehow updates if something changes 

    //what is the current cToken future price?
    //will call the blockchain to find the current bid price
    const cTokenFuturePrice = await fp();
    this.setState({ cTokenFuturePrice });
    const cTokenFutureSize = await fs();
    this.setState({cTokenFutureSize})

    //what is the Indicated implied yield from this?
    const indicRate = (cTokenFuturePrice/exchangeRateCurrent-1)*(1/dayCount)*100;
    var displayIndicRate = indicRate.toFixed(3);
    this.setState({displayIndicRate});    
  }
  constructor(props){
    super(props)
    this.state = { displayIndicRate: this.props.displayIndicRate }
  }

  render(){
    return (
      <div>
        <h4>Implied Fixed Rate (APY) : {this.state.displayIndicRate}%</h4>
        <br/>
        <h5>The Market</h5>
        <p>cUSDC exchange rate : {this.state.exchangeRateCurrent}</p>
        <p>cUSDC Future bid price : {this.state.cTokenFuturePrice}</p>
        <p>cUSDC Future bid size : {this.state.cTokenFutureSize}</p>
        <p>Current block number : {this.state.currentBlock}</p>
        <p>Blocks to Expiry : {this.state.blocksToExpiry}</p>
        <p>Estimated Expiry Date : {this.state.expiryDate}</p>
        <br/>
      </div>
    );
  }
}

class BalanceComponent extends Component{

  componentDidMount(){
      this.checkAccount();
  }

  //checks if metamask is connected
  //if is it, it fetches the balance data
  //if it is not, then it shows ''
  async checkAccount () {
    const accounts = await web3.eth.getAccounts();
    this.setState({account: accounts[0]});
    myWalletAddress = accounts[0];
    console.log('balance compoment checking account : ' +myWalletAddress);

    //Return here if myWalletAddress is undefined, null or an empty string
    if (!myWalletAddress) return;

    //what is your current balance?
    const cUsdcBalanceRaw = await irsAgentContract.methods.balanceOf(myWalletAddress).call()/scaler.cusdc;
    const cUsdcBalance = cUsdcBalanceRaw.toFixed(2)
    this.setState({cUsdcBalance});
    console.log('cUsdcBalance is ' + cUsdcBalance);

    //what is your balance in usdc terms?
    const exchangeRateCurrent = await cUsdcContract.methods.exchangeRateCurrent().call()/scaler.cusdcRate;
    const usdcBalanceRaw = cUsdcBalanceRaw*exchangeRateCurrent;
    const usdcBalance = usdcBalanceRaw.toFixed(4)
    this.setState({usdcBalance})

    //what is your current futures position
    const entries = await getEntries(myWalletAddress);
    const size = entries.size/scaler.cusdc;
    this.setState({size});

    //what is the price you traded at?
    const priceTraded = entries.price/scaler.cusdcRate;
    this.setState({priceTraded});

    //what is your balance at expiry?
    //to do need to get a concept of "traded Price"
    const usdcBalanceAtExpiryRaw = -size*priceTraded;
    const usdcBalanceAtExpiry = usdcBalanceAtExpiryRaw.toFixed(4)
    this.setState({usdcBalanceAtExpiry});

    //how much interest have you locked in?
    const usdcInterestLockedRaw = usdcBalanceAtExpiryRaw - usdcBalanceRaw;
    const usdcInterestLocked = usdcInterestLockedRaw.toFixed(4)
    this.setState({usdcInterestLocked});

    //date should come from the IRS Agent smart contract, but using a hardcode for now
    //time to expiry? - doing this operation multiple times...
    const blocksToExpiry = await xblck();
    const timeLeft = blocksToExpiry * 13 * 1000
    const dayCount = timeLeft/msPerYear;


    //what is the fixed rate we've locked in?
    const impliedFixedRate = (usdcInterestLocked/usdcBalanceRaw*1/dayCount*100).toFixed(3);
    this.setState({impliedFixedRate})

  }
  constructor(props){
    super(props)
    this.state = { cUsdcBalance: ''}
  }

  render(){
    return (
      <div>
        <h5>Your Position</h5>
        <p>Your current cUSDC balance is : {this.state.cUsdcBalance} </p>
        <p>Equivalent USDC balance is : {this.state.usdcBalance}</p>
        <p>Your position in cUSDC futures are : {this.state.size}</p>
        <p>You sold them at : {this.state.priceTraded}</p>
        <p>At expiry you will have : {this.state.usdcBalanceAtExpiry} </p>
        <p>You have locked in : {this.state.usdcInterestLocked} USDC</p>
        <p>The implied fixed rate is : {this.state.impliedFixedRate}%</p>
      </div>
    );
  }
}

//add button that connects to metamask
class EthButton extends React.Component {
  constructor(props) {
    super(props);
    if(!myWalletAddress) {
      this.state = {value: "Connect MetaMask"};
    }
    else{
    this.state = {value: myWalletAddress}};
  }
  render() {
    return (
      <div className="container">
        <div className="row float-end">
          <div className="col-md-12">
              <button className = "btn btn-primary"onClick={
                  () => ethereum.request({ method: 'eth_requestAccounts' }).then(
                            result => this.setState({value: result})
                  )}>
                  {this.state.value}
              </button>
          </div>
        </div>
      </div>
    );
  }
}

//a form that takes a number input from the user
class DepositForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {value: ''};
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({value: event.target.value});
  }

  async handleSubmit(event) {
    //this is where we ask smart contracts
    //deposit will be a mint
    //the contract will ask for approval first
    //having trouble keeping track of when the numbers are scaled.
    //going to start calling them big if they are scaled as in blockchain
    const exchangeRateBig = new BigNumber(await cUsdcContract.methods.exchangeRateCurrent().call());
    const exchangeRate = new BigNumber(exchangeRateBig/scaler.cusdcRate);
    const USDCquantity = this.state.value;
    const USDCquantityBig = new BigNumber(USDCquantity*scaler.usdc);
    const cUSDCquantity = new BigNumber(USDCquantity/exchangeRate);
    const cUSDCquantityBig = new BigNumber(cUSDCquantity*scaler.cusdc);

    const accounts = await web3.eth.getAccounts();
    myWalletAddress = accounts[0];

    // we are depositing to the irs contract. Tell the contract to allow cUSDC to be taken by the irsAgent contract
    await usdcContract.methods.approve(irsAgentAddress, USDCquantityBig).send({'from': myWalletAddress}, hash);

    console.log(`USDC contract "Approve" operation successful.`);
    console.log(`Supplying USDC to the Irs Agent...`, '\n');

    //what is the current balance?
    const balance = await irsAgentContract.methods.balanceOf(myWalletAddress).call();
    console.log('cUSDC balance in irs agent contract is ' + balance);
    
    //deposit into the contract
    await irsAgentContract.methods.deposit(USDCquantityBig, usdcAddress).send({'from':myWalletAddress}, hash);
    console.log(`cUSDC deposit operation successful.`)

    //what is the new balance now?
    const balanceNew = await irsAgentContract.methods.balanceOf(myWalletAddress).call();
    const balanceChange = balanceNew - balance;
    console.log('cUSDC balance in irs agent contract is now ' + balanceNew);
    console.log('we have added cUSDC amount of ' + balanceChange);
    console.log('we are selling cUSDC futures ' + balanceChange);

    //what is the current future bid price?
    const cTokenFuturePrice = await fp();
    const fpBig = new BigNumber(cTokenFuturePrice*scaler.cusdcRate);
    console.log('getting current future bid price : ' + fpBig);

    await irsAgentContract.methods.openShort(balanceChange, fpBig).send({'from' : myWalletAddress}, hash);
    console.log('short position opened successfully ' + hash);

    const entries = await getEntries(myWalletAddress);
    console.log('we got the entries. Here is the balance ' + entries.balance);

    event.preventDefault();
  }
  render() {
    return (
      <div className="input-group input-group-lg mx-auto">
          <input type="number" min = '0' className="form-control" placeholder="USDC Amount" aria-label="depositAmountInput" aria-describedby="basic-addon2" value={this.state.value} onChange={this.handleChange} />
          <div className="input-group-append">
          <button className="btn btn-outline-secondary btn-lg" type="button" onClick={this.handleSubmit}>Deposit</button>
          </div>
      </div>
    );
  }
}

//This is where we set the quote
class SetQuoteForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = { bidPrice: '' , bidSize: '', askPrice: '' , askSize: '' };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({[event.target.name] : event.target.value});
  }

  async handleSubmit(event) {
    //check if the account is the owner
    const accounts = await web3.eth.getAccounts();
    myWalletAddress = accounts[0]; 
    const checkAddress = myWalletAddress.toString() //need to change the data to lowercase
    
    console.log("we got here")
    //if the wallet address is not the owner, show this alert
    if (checkAddress.toLowerCase() != owner){
      window.alert("Must be the Owner to Set Quote");
      return
    }
    const { bidPrice, bidSize, askPrice, askSize } = this.state;
    console.log('bid price is :' + bidPrice);
    console.log('bid size is :' + bidSize);
    console.log('ask price is :' + askPrice);
    console.log('ask size is :' + askSize);

    const bidPriceBig = new BigNumber(bidPrice*scaler.cusdcRate);
    const bidSizeBig = new BigNumber(bidSize*scaler.cusdc);
    const askPriceBig = new BigNumber(askPrice*scaler.cusdcRate);
    const askSizeBig = new BigNumber(askSize*scaler.cusdc);

    //at the moment this is giving me an error
    console.log('bid price : ' + bidPriceBig.toFixed(0) + 'bid size : ' +  bidSizeBig.toFixed(0));
    await irsAgentContract.methods.setQuote(bidPriceBig.toFixed(0), bidSizeBig.toFixed(0), askPriceBig.toFixed(0), askSizeBig.toFixed(0)).send({'from' : myWalletAddress},hash);

    const result = await irsAgentContract.methods.fullQuote().call();
    console.log('This is the full quote :', '\n', 'bid price: ' + result[0], '\n', 'bid size: ' + result[1]);
  }
  render() {
    return (
      <form>
        <div>
          <label htmlFor='bidPrice'>Bid Price</label>
          <input 
            name='bidPrice'
            type='number'
            placeholder='Bid Price' 
            value = {this.state.bidPrice}
            onChange={this.handleChange}
          />
        </div>
        <div>
          <label htmlFor='bidSize'>Bid Size</label>
          <input
            name='bidSize'
            type='number'
            placeholder='Bid Size'
            value={this.state.bidSize}
            onChange={this.handleChange}
          />
        </div>
        <div>
          <label htmlFor='askPrice'>Ask Price</label>
          <input
            name='askPrice'
            type='number'
            placeholder='Ask Price'
            value={this.state.askPrice}
            onChange={this.handleChange}
          />
        </div>
        <div>
        <label htmlFor='askSize'>Ask Size</label>
          <input
            name='askSize'
            type='number'
            placeholder='Ask Size'
            value={this.state.askSize}
            onChange={this.handleChange}
          />
        </div>
        <div>
          <button className="btn btn-outline-secondary btn-lg" type="button" onClick={this.handleSubmit}>Enter Order</button>
        </div>
      </form>

    );
  }
}


function App() {
  
  return (
    <div className = 'container'>
        <br/>       
        <EthButton/>
        <br />
        <br/>
        <div className = 'container'>
          <div className = 'row'>
          <div className = 'col'></div>
          <div className = 'col-8'>
            <img src = {logo} height = '70px' width ='auto'/>
            <h3 className ='text-center'>Fixed Rate Deposits on Compound</h3>
            <br />
            <DepositForm/>
            <br />
            <Ticker/>
            <BalanceComponent />
            <br/>
            <h4>Order Entry</h4>
            <SetQuoteForm />
          </div>
          <div className = 'col'></div>
          </div>
        </div>
    </div>
  );
}



export default App;

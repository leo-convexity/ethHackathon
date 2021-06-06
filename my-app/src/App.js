import style from './App.css';
import React, { Component } from 'react';
import { render } from 'react-dom';
import BigNumber from 'bignumber.js';
import logo from './1.png';
import constants from './components/constants.js';

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
const dayCount = (expiryDateObject.getTime() - today.getTime()) / msPerYear; //returns the daycount in terms of fraction of year left in milliseconds
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
    


var myWalletAddress = null;
class Ticker extends Component{

  componentDidMount(){
    this.loadBlockchainData()
  }
  //load current blockchain data - what is the current exchange rate?
  //what is the cToken future price exchange rate?
  async loadBlockchainData () {    
    //what is the current cToken exchange rate?
    const exchangeRateCurrent = await cUsdcContract.methods.exchangeRateCurrent().call()/scaler.cusdcRate;
    this.setState({ exchangeRateCurrent});

    //date should come from the IRS Agent smart contract, but using a hardcode for now
    
    const expiryDate = expiryDateObject.toString()
    this.setState({expiryDate});

    //creating variables that will later reference the blockchain - will need to make this so it somehow updates if something changes 

    //what is the current cToken future price?
    //will call the blockchain to find the current bid price. but for now use the manual price
    const cTokenFuturePrice = await irsAgentContract.methods.bidPrice().call()/scaler.cusdcRate;
    this.setState({ cTokenFuturePrice});

    //what is the implied yield from this?
    const fixedImpliedRate = (cTokenFuturePrice/exchangeRateCurrent-1)*(1/dayCount)*100;
    var displayImpliedRate = fixedImpliedRate.toFixed(3);
    this.setState({displayImpliedRate});    
  }
  constructor(props){
    super(props)
    this.state = { account: ''}
  }

  render(){
    return (
      <div>
        <h4>Implied Fixed Rate (APY) : {this.state.displayImpliedRate}%</h4>
        <p>cUSDC exchange rate : {this.state.exchangeRateCurrent}</p>
        <p>cUSDC Future bid price : {this.state.cTokenFuturePrice}</p>
        <p>Expiry Date : {this.state.expiryDate}</p>
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

    //what is your balance at expiry?
    const cTokenFuturePrice = cTokenFuturePriceManual;//exchangeRateCurrent * (1 + overRideRate * dayCount) //await cUsdcContract.methods.exchangeRateCurrent().call()/10**16;
    const usdcBalanceAtExpiryRaw = cUsdcBalanceRaw*cTokenFuturePrice;
    const usdcBalanceAtExpiry = usdcBalanceAtExpiryRaw.toFixed(4)
    this.setState({usdcBalanceAtExpiry});

    //how much interest have you locked in?
    const usdcInterestLockedRaw = usdcBalanceAtExpiryRaw - usdcBalanceRaw;
    const usdcInterestLocked = usdcInterestLockedRaw.toFixed(4)
    this.setState({usdcInterestLocked});

  }
  constructor(props){
    super(props)
    this.state = { cUsdcBalance: ''}
  }

  render(){
    return (
      <div>
        <p>Your current cUSDC balance is : {this.state.cUsdcBalance} </p>
        <p>Equivalent USDC balance is : {this.state.usdcBalance}</p>
        <p>At expiry you will have : {this.state.usdcBalanceAtExpiry} </p>
        <p>You have locked in : {this.state.usdcInterestLocked} USDC</p>
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
    console.log('current exchange rate is ' + exchangeRate);
    console.log('USDC amount is ' + USDCquantity);
    console.log('cUSDC amount is ' + cUSDCquantity);
    console.log('the block chain gets USDC amount of ' + USDCquantityBig);
    console.log('and cUSDC amount of ' + cUSDCquantityBig);

    const accounts = await web3.eth.getAccounts();
    myWalletAddress = accounts[0];

    // we are depositing to the irs contract. Tell the contract to allow cUSDC to be taken by the irsAgent contract
    await usdcContract.methods.approve(irsAgentAddress, USDCquantityBig).send({'from': myWalletAddress}, hash);

    console.log(`USDC contract "Approve" operation successful.`);
    console.log(`Supplying USDC to the Irs Agent...`, '\n');

    const balance = await irsAgentContract.methods.balanceOf(myWalletAddress).call();
    console.log('cUSDC balance in irs agent contract is ' + balance);
    
    await irsAgentContract.methods.deposit(USDCquantityBig, usdcAddress).send({'from':myWalletAddress}, hash);
    
    console.log(`cUSDC deposit operation successful.`, '\n')
    const balanceNew = await irsAgentContract.methods.balanceOf(myWalletAddress).call();
    console.log('cUSDC balance in irs agent contract is now ' + balanceNew);
    //alert('You want to deposit ' + this.state.value + ' USDC');

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
            <img src = {logo} height = '60px' width ='auto'/>
            <h3 className ='text-center'>Fixed Rate Deposits on Compound</h3>
            <br />
            <DepositForm/>
            <br />
            <Ticker />
            <BalanceComponent />
            <br/>
            <SetQuoteForm />
          </div>
          <div className = 'col'></div>
          </div>
        </div>
    </div>
  );
}



export default App;

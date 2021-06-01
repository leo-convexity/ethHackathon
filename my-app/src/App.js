import style from './App.css';
import React, { Component } from 'react';
import { render } from 'react-dom';
import BigNumber from 'bignumber.js';

//copy pasted the config file from api-guide-example 
const config = require('./config_mainnet.json');
const irsConfig = require('./py/deployed_irs_agent.json'); //gets the deployed_irs_agent.json file
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

const overRideRate = 0.0834
const expiryDateObject = new Date('June 2 2021');
const today = new Date();
const msPerYear = 24 * 60 * 60 * 1000 *365; // Number of milliseconds per year
const dayCount = (expiryDateObject.getTime() - today.getTime()) / msPerYear; //returns the daycount in terms of fraction of year left in milliseconds
    


var myWalletAddress = 0;
class Ticker extends Component{

  componentDidMount(){
    this.loadBlockchainData()
  }
  //load current blockchain data - what is the current exchange rate?
  //what is the cToken future price exchange rate?
  async loadBlockchainData () {    
    //what is the current cToken exchange rate?
    const exchangeRateCurrent = await cUsdcContract.methods.exchangeRateCurrent().call()/10**16;
    this.setState({ exchangeRateCurrent});

    //date should come from the IRS Agent smart contract, but using a hardcode for now
    
    const expiryDate = expiryDateObject.toString()
    this.setState({expiryDate});

    //creating variables that will later reference the blockchain - will need to make this so it somehow updates if something changes 

    //what is the current cToken future price?
    const cTokenFuturePriceRaw = exchangeRateCurrent * (1 + overRideRate * dayCount) //await cUsdcContract.methods.exchangeRateCurrent().call()/10**16;
    const cTokenFuturePrice = cTokenFuturePriceRaw.toFixed(16)
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
        <h4>Implied Fixed Rate is : {this.state.displayImpliedRate}%</h4>
        <p>cUSDC exchange rate : {this.state.exchangeRateCurrent}</p>
        <p>cToken future price : {this.state.cTokenFuturePrice}</p>
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

    //what is your current balance?
    const cUsdcBalanceRaw = await irsAgentContract.methods.balanceOf(myWalletAddress).call()/1e8;
    const cUsdcBalance = cUsdcBalanceRaw.toFixed(4)
    this.setState({cUsdcBalance});
    console.log('cUsdcBalance is ' + cUsdcBalance);

    //what is your balance in usdc terms?
    const exchangeRateCurrent = await cUsdcContract.methods.exchangeRateCurrent().call()/10**16;
    const usdcBalanceRaw = cUsdcBalanceRaw*exchangeRateCurrent;
    const usdcBalance = usdcBalanceRaw.toFixed(6)
    this.setState({usdcBalance})

    //what is your balance at expiry?
    const cTokenFuturePrice = exchangeRateCurrent * (1 + overRideRate * dayCount) //await cUsdcContract.methods.exchangeRateCurrent().call()/10**16;
    const usdcBalanceAtExpiryRaw = cUsdcBalanceRaw*cTokenFuturePrice;
    const usdcBalanceAtExpiry = usdcBalanceAtExpiryRaw.toFixed(6)
    this.setState({usdcBalanceAtExpiry});

    //how much interest have you locked in?
    const usdcInterestLockedRaw = usdcBalanceAtExpiryRaw - usdcBalanceRaw;
    const usdcInterestLocked = usdcInterestLockedRaw.toFixed(6)
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
    if(myWalletAddress === 0) {
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
              <button className = "btn btn-primary float-right"onClick={
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
    const exchangeRate = new BigNumber(exchangeRateBig/1e16);
    const USDCquantity = this.state.value;
    const USDCquantityBig = new BigNumber(USDCquantity*10**6);
    const cUSDCquantity = new BigNumber(USDCquantity/exchangeRate);
    const cUSDCquantityBig = new BigNumber(cUSDCquantity*10**8);
    console.log('current exchange rate is ' + exchangeRate);
    console.log('USDC amount is ' + USDCquantity);
    console.log('cUSDC amount is ' + cUSDCquantity);
    console.log('the block chain gets USDC amount of ' + USDCquantityBig);
    console.log('and cUSDC amount of ' + cUSDCquantityBig);

    const accounts = await web3.eth.getAccounts();
    myWalletAddress = accounts[0];

    // we are depositing to the irs contract. Tell the contract to allow cUSDC to be taken by the irsAgent contract
    await usdcContract.methods.approve(irsAgentAddress, USDCquantityBig).send({'from': myWalletAddress});

    console.log(`USDC contract "Approve" operation successful.`);
    console.log(`Supplying USDC to the Irs Agent...`, '\n');

    const balance = await irsAgentContract.methods.balanceOf(myWalletAddress).call();
    console.log('cUSDC balance in irs agent contract is ' + balance);
    
    await irsAgentContract.methods.deposit(USDCquantityBig, usdcAddress).send({'from':myWalletAddress});
    
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

//

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
            <h3 className ='text-center'>Fixed Rate Deposits on Compound</h3>
            <br />
            <DepositForm/>
            <br />
            <Ticker />
            <BalanceComponent />
          </div>
          <div className = 'col'></div>
          </div>
        </div>
    </div>
  );
}



export default App;
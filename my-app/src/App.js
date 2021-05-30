import style from './App.css';
import React, { Component } from 'react';
import { render } from 'react-dom';
import BigNumber from 'bignumber.js';

const bigNumber = require('bignumber.js');

//copy pasted the config file from api-guide-example 
const config = require('./config_mainnet.json');
const irsConfig = require('./py/deployed_irs_agent.json'); //gets the deployed_irs_agent.json file
const Web3 = require('web3' || "http://127.0.0.1:8545");

//changed to givenProvider to see if we can work with MetaMask
const web3 = new Web3(Web3.givenProvider);
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

const ethereum = window.ethereum;

//calculating fixed rate deposits
//expiryDate should come from the smartContract that defines the cTokenFuture
const expiryDate = new Date('June 25 2021');
var today = new Date();
var msPerYear = 24 * 60 * 60 * 1000 *365; // Number of milliseconds per year
var dayCount = (expiryDate.getTime() - today.getTime()) / msPerYear; //returns the daycount in terms of fraction of year left in milliseconds
console.log('daycount = ' + dayCount);
//creating variables that will later reference the blockchain - will need to make this so it somehow updates if something changes 
var exchangeRateCurrent = 0.02222;
var cTokenFuturePrice = 0.022645;
var fixedImpliedRate = (cTokenFuturePrice/exchangeRateCurrent-1)*(1/dayCount)*100;
console.log('exchangeRateCurrent = ' + exchangeRateCurrent);

const styles = {
  height: 50,
  backgroundColor: 'green'
};

var myWalletAddress = 0;

const fromMyWallet = {
  from: myWalletAddress,
  gasLimit: web3.utils.toHex(500000),
  gasPrice: web3.utils.toHex(20000000000) // use ethgasstation.info (mainnet only)
};


class Ticker extends Component{

  componentDidMount(){
    this.loadBlockchainData()
  }
  async loadBlockchainData () {
    const accounts = await web3.eth.getAccounts()
    this.setState({account: accounts[0]})
    myWalletAddress = accounts[0];
    console.log('acccount : ' +accounts[0])
    this.setState({ cUsdcContract })
    const exchangeRateCurrent = await cUsdcContract.methods.exchangeRateCurrent().call()
    this.setState({ exchangeRateCurrent})
    console.log('irsAgent address : ' + irsAgentAddress)

  }
  constructor(props){
    super(props)
    this.state = { account: ''}
  }

  render(){
    return (
      <div>
        <p>cUSDC exchange rate : {this.state.exchangeRateCurrent/10**16}</p>
      </div>
    );
  }
}

//add button that connects to metamask
class EthButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {value: "Connect MetaMask"};
  }
  render() {
    return (
       <button style = {styles} onClick={
        () => ethereum.request({ method: 'eth_requestAccounts' }).then(
                result => this.setState({value: result})
      )}>
      {this.state.value}
      </button>
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
    //find out what the exchange rate is
    const exchangeRateCurrent = await cUsdcContract.methods.exchangeRateCurrent().call()
    let adj_quantity = new BigNumber(this.state.value*Math.pow(10,18))/exchangeRateCurrent;
    console.log('current exchange rate is ' + exchangeRateCurrent);
    console.log('adjust quantity is ' + adj_quantity);
    const accounts = await web3.eth.getAccounts();
    myWalletAddress = accounts[0];
    const adj_allowance = await usdcContract.methods.allowance(accounts[0], cUsdcAddress).call();
    console.log('allowance :' + adj_allowance);
    console.log('myWalletAddress : ' + myWalletAddress)

    // we are depositing to the irs contract. Tell the contract to allow cUSDC to be taken by the irsAgent contract
    await cUsdcContract.methods.approve(irsAgentAddress, adj_quantity).send({'from': accounts[0]});

    console.log(`cUSDC contract "Approve" operation successful.`);
    console.log(`Supplying cUSDC to the Irs Agent...`, '\n');

    await irsAgentContract.methods.deposit(adj_quantity).send({'from':accounts[0]});
    
    console.log(`cUSDC deposit operation successful.`, '\n')
    
    //alert('You want to deposit ' + this.state.value + ' USDC');
    
    event.preventDefault();
  }

  render() {
    return (
      <div className="input-group mb-3">
          <input type="number" className="form-control" placeholder="USDC Amount" aria-label="depositAmountInput" aria-describedby="basic-addon2" value={this.state.value} onChange={this.handleChange} />
          <div className="input-group-append">
          <button className="btn btn-outline-secondary" type="button" onClick={this.handleSubmit}>Deposit</button>
          </div>
      </div>
     // <form onSubmit={this.handleSubmit}>
     //       Fixed Rate Deposit Amount :
     //     <input className = "form-control form-control-lg" type="number"  />
     //   <input type="submit" value="Deposit" />
      //</form>
    );
  }
}



class FixedRate extends React.Component{
  constructor(props){
    super(props);
  }
  render(){
    return (
        <div>
          Your Fixed Rate will be {fixedImpliedRate}%
        </div>
    )
  }
}


function App() {
  return (
    <div className="container">
      
        <EthButton/>
        <Ticker />       
        <br />
        <DepositForm/>
        <br />
        <FixedRate />

    </div>
  );
}



export default App;
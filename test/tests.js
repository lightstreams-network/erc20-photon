require('events').EventEmitter.prototype._maxListeners = 100;

const path = require('path');
const fs = require('fs');
const assert = require('chai').assert;

const ganche = require('ganache-cli');
const HDWalletProvider = require('truffle-hdwallet-provider');
const provider = new HDWalletProvider(
  'inform alpha success reunion weasel tortoise ancient purchase average shoulder steel volcano',
  'https://rinkeby.infura.io/v3/1b651419fc314be8aef2c04b85b2d250'
);

const Web3 = require('web3');
//const web3 = new Web3(ganche.provider());
const web3 = new Web3(provider);

// Lightsteam Token Contract
const lightstreamTokenPath = path.resolve(__dirname, '../contracts/build/contracts', 'LightstreamToken.json');
const lightstreamTokenJSON = fs.readFileSync(lightstreamTokenPath, 'utf8');
const { abi: lightstreamTokenAbi, bytecode: lightstreamTokenBytecode } = JSON.parse(lightstreamTokenJSON);

// Sample Crowdsale Contract
// OpenZepplinSampleSale.sol  LightstreamCrowdsale
const lightstreamCrowdsalePath = path.resolve(__dirname, '../contracts/build/contracts', 'LightstreamCrowdsale.json');
const lightstreamCrowdsaleJSON = fs.readFileSync(lightstreamCrowdsalePath, 'utf8');
const { abi: lightstreamCrowdsaleAbi, bytecode: lightstreamCrowdsaleBytecode } = JSON.parse(lightstreamCrowdsaleJSON);

// Monthly Token Vesting
const tokenVestingPath = path.resolve(__dirname, '../contracts/build/contracts', 'MonthlyTokenVesting.json');
const tokenVestingJSON = fs.readFileSync(tokenVestingPath, 'utf8');
const { abi: tokenVestingAbi, bytecode: tokenVestingBytecode } = JSON.parse(tokenVestingJSON);

// Distribution Contract
const teamDistributionPath = path.resolve(__dirname, '../contracts/build/contracts', 'TeamDistribution.json');
const teamDistributionJSON = fs.readFileSync(teamDistributionPath, 'utf8');
const { abi: teamDistributionAbi, bytecode: teamDistributionBytecode } = JSON.parse(teamDistributionJSON);


/*
 * Helper functions used to for debugging and manipulating blockchain for tests
 */

function printData(testName, data) {
  console.log(`---------------------------------${testName}--------------------------------------`);
  console.log(data);
  console.log('----------------------------------------------------------------------------------');
}

const timeTravel = function (time) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [time], // 86400 is num seconds in day
      id: new Date().getTime()
    }, (err, result) => {
      if(err){ return reject(err) }
      return resolve(result)
    });
  })
};

const mineBlock = function () {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_mine"
    }, (err, result) => {
      if(err){ return reject(err) }
      return resolve(result)
    });
  })
};

/*
 * Global variables
 */

let accounts;
let lightstreamTokenContract;
let lightstreamTokenAddress;
let distributionContract;
let distributionContractAddress;
let vestingContact;
let vestingContractAddress;
let sampleCrowdsaleContract;
let timeOffset = 3600 * 24 * 30; // 30 days
let startTime = Math.floor(new Date().getTime() /1000 + (3600 * 24));;
let endTime= startTime + timeOffset;
let walletAdress;

/*
 * Before running tests deploy the token contract, deploy the crowdsale contract, and then tranfer
 * ownership of the token contract to the crowsale contract
 */
//function(done)
before(async function(done) {
  this.timeout(60 * 1000 * 10);
  // Get list of accounts provided by Ganche
  accounts = await web3.eth.getAccounts();
  walletAdress = accounts[9];
  printData('lightstreamTokenContractBytecode', lightstreamTokenBytecode.length);
  printData('teamDistributionBytecode', teamDistributionBytecode.length);
  printData('lightstreamCrowdsaleBytecode', lightstreamCrowdsaleBytecode);

  // Deploy the Lightstream Token Contract
  printData('lightstreamTokenContractBytecode', lightstreamTokenBytecode.length);
  lightstreamTokenContract = await new web3.eth.Contract(lightstreamTokenAbi)
    .deploy({ data: lightstreamTokenBytecode, arguments: []})
    .send({ from: accounts[0], gas: '4712387' });

  // Get the address of the Lightstream Token
  lightstreamTokenAddress = lightstreamTokenContract.options.address;

  printData('lightstreamTokenAddress', lightstreamTokenAddress);

  // Deploy the distribution Contract
  printData('teamDistributionBytecode', teamDistributionBytecode.length);
  distributionContract = await new web3.eth.Contract(teamDistributionAbi)
    .deploy({ data: teamDistributionBytecode, arguments: [startTime.toString(), lightstreamTokenAddress]})
    .send({ from: accounts[0], gas: '4712388' });

  distributionContractAddress = distributionContract.options.address;

  printData('distributionContractAddress', distributionContractAddress);

  // Convert 1 Ether to Wei and convert to Big Number format
  const etherInWei = web3.utils.toWei('86200', 'ether');
  const cap = web3.utils.toBN(etherInWei);

  // Deploy Crowdsale Contract with constructor arguments Start Time, End Time, Wallet for funds to be deposited, and Address of Lightingstream Token
  try {
     printData('lightstreamCrowdsaleBytecode', lightstreamCrowdsaleBytecode);
    sampleCrowdsaleContract = await new web3.eth.Contract(lightstreamCrowdsaleAbi)
      .deploy({ data: lightstreamCrowdsaleBytecode, arguments: [startTime.toString(), endTime.toString(), walletAdress, lightstreamTokenAddress, distributionContractAddress]})
      .send({ from: accounts[0], gas: '4712388', gasLimit: '10000000' });

      // uint256 _openingTime,
      // uint256 _closingTime,
      // uint256 _rate,
      // address _wallet,
      // uint256 _cap,
      // MintableToken _token,
      // uint256 _goal

    //_rate, _wallet, _token
    // startTime.toString(), endTime.toString(), 2733, walletAdress, cap, lightstreamTokenAddress, cap
    sampleCrowdsaleContract = await new web3.eth.Contract(lightstreamCrowdsaleAbi)
      .deploy({ data: lightstreamCrowdsaleBytecode, arguments: [startTime.toString(), endTime.toString(), 2733, walletAdress, cap, lightstreamTokenAddress, cap]})
      .send({ from: accounts[0], gas: '6000000' });
  }catch(error){
    printData('sampleCrowdsaleContract - Deploy - error', error);
  }

  printData('sampleCrowdsaleContract', sampleCrowdsaleContract.options.address);

  // Transfer ownership to the crowdsale contract so only it can mint tokens
  await lightstreamTokenContract.methods.transferOwnership(sampleCrowdsaleContract.options.address).send({ from: accounts[0], gas: '4712388' });

  done();
});

// 12664 - bytecode length,  6000000 gas, - Error: The contract code couldn't be stored, please check your gas limit., - Rinkeby
// 34238 - bytecode length,  6000000 gas, - Error: The contract code couldn't be stored, please check your gas limit., - Rinkeby
// 12074 - bytecode length,  4712388 gas, - Error: The contract code couldn't be stored, please check your gas limit., - Rinkeby
// 21048 - bytecode length,  6000000 gas, - Error: The contract code couldn't be stored, please check your gas limit., - Rinkeby
// 17462 - bytecode length,  6000000 gas, - Error: The contract code couldn't be stored, please check your gas limit., - Rinkeby
// 17462 - bytecode length,  4712388 gas, - Error: The contract code couldn't be stored, please check your gas limit., - Rinkeby
//  7888 - bytecode length,  4712388 gas, - Error: The contract code couldn't be stored, please check your gas limit., - Rinkeby
//  3676 - bytecode length,  4712388 gas, - Error: The contract code couldn't be stored, please check your gas limit., - Rinkeby
//  3646 - bytecode length,  4712388 gas, - Error: The contract code couldn't be stored, please check your gas limit., - Rinkeby
//  3646 - bytecode length,  4712388 gas, - Error: The contract code couldn't be stored, please check your gas limit., - Rinkeby - Didn't work when using contract to inherit crowdsale contract and initialize in constructor
//  3220 - bytecode length,  4712388 gas, Worked when only deploying base contract and commenting out - require(_rate > 0); require(_wallet != address(0)); require(_token != address(0));
//  3886 - bytecode length,  4712388 gas, Worked when using TimedContract in constructor and commenting out - require(_rate > 0); require(_wallet != address(0)); require(_token != address(0));
//  4302 - bytecode length,  4712388 gas, Didn't work when using TimedContract, CappedCrowdsale and RefundableCrowdsale in constructor and commenting out - require(_rate > 0); require(_wallet != address(0)); require(_token != address(0));
//              didn't log,  4712388 gas, - Error:VM Exception while processing transaction: out of gas              , - Ganache

/*
 * Tests to that the Lightstream Token and Whitelisted Crowdsale Contracts were deployed and have an address
 */

describe('The contacts are deployed', ()=> {
  it('deploys a Lightstream Token Contract', ()=> {
    assert.ok(lightstreamTokenContract.options.address);
  });

  it('deploys a Whitelisted Crowdsale Contract', ()=> {
    assert.ok(sampleCrowdsaleContract.options.address);
  });

  it('deploys a Distribution Contract', ()=> {
    assert.ok(distributionContract.options.address);
  });
});

/*
 * Tests the owners ability to add and remove whitelisted addresses found in the Whitelist.sol contract
 */

describe('Tests the Whitelist.sol contract functionality', ()=> {
  // addAddressToWhitelist - addAddressToWhitelist(address)
  it('Allows the owner to add an address to the whitelist', async ()=> {
    const addAddressToWhitelist = await sampleCrowdsaleContract.methods.addAddressToWhitelist(accounts[2]).send({ from: accounts[0], gas: '4712388' });
    // printData('addAddressToWhitelist', addAddressToWhitelist);
  });

  // addAddressesToWhitelist(address[])
  it('Allows the owner to add multiple addresses to the whitelist', async ()=> {
    await sampleCrowdsaleContract.methods.addAddressesToWhitelist([accounts[3], accounts[4], accounts[5]]).send({ from: accounts[0], gas: '4712388' });
  });

  // whitelist(address)
  it('Returns True if the Owner checks to see if a previously added address has been whitelisted', async ()=> {
    const response = await sampleCrowdsaleContract.methods.whitelist(accounts[3]).call();
    assert.equal(response, true);
  });

  // whitelist - whitelist(address)
  it('Returns False if the Owner checks an address not added to the whitelisted', async ()=> {
    const response = await sampleCrowdsaleContract.methods.whitelist(accounts[9]).call();
    assert.equal(response, false);
  });

  // removeAddressFromWhitelist(address)
  it('Allows the owner to remove an address that has already been added to the whitelist', async ()=> {
    await sampleCrowdsaleContract.methods.removeAddressFromWhitelist(accounts[2]).send({ from: accounts[0], gas: '4712388' });

    const response = await sampleCrowdsaleContract.methods.whitelist(accounts[2]).call();

    assert.equal(response, false);
  });

  // removeAddressesFromWhitelist(address[])
  it('Allows the owner to remove several addresses that have already been added to the whitelist', async ()=> {
    await sampleCrowdsaleContract.methods.removeAddressesFromWhitelist([accounts[3], accounts[4], accounts[5]]).send({ from: accounts[0], gas: '4712388' });

    const response1 = await sampleCrowdsaleContract.methods.whitelist(accounts[3]).call();
    const response2 = await sampleCrowdsaleContract.methods.whitelist(accounts[4]).call();
    const response3 = await sampleCrowdsaleContract.methods.whitelist(accounts[5]).call();

    assert.equal(response1, false);
    assert.equal(response2, false);
    assert.equal(response3, false);
  });

});

/*
 * Tests retrieving the token cap and if the cap has been reached in the TokenCappedCrowdsale.sol contract
 */

describe('Tests the TokenCappedCrowdsale.sol functionality', async ()=> {
  // cap()
  it('Returns the cap amount when the crowdsale contract was deployed', async ()=> {
    const tokenCap = await sampleCrowdsaleContract.methods.tokenCap().call();

    printData('tokenCap', tokenCap);
    assert.equal(165000000000000000000000000, tokenCap);
  });

  // capReached()
  it('Returns False if the cap amount has not been reached yet', async ()=> {
    const response = await sampleCrowdsaleContract.methods.capReached().call();

    assert.equal(false, response);
  });

});


/*
 * Tests retrieving the openingTime, closingTime, and hasClosed functions in the TimedCrowdsale.sol contract
 */

describe("Tests the TimedCrowdsale.sol functionality", async ()=> {
  // openingTime()
  it('Returns the opening time timestamp in epoch format from when the contract was initialized', async ()=> {
    const response = await sampleCrowdsaleContract.methods.openingTime().call();

    assert.equal(startTime, response);
  });

  // closingTime()
  it('Returns the closing time timestamp in epoch format from when the contract was initialized', async ()=> {
    const response = await sampleCrowdsaleContract.methods.closingTime().call();

    assert.equal(endTime, response);
  });

  // hasClosed()
  it('Returns false if the crowdsale has not reached it\'s closing time', async ()=> {
    const response = await sampleCrowdsaleContract.methods.hasClosed().call();

    assert.equal(false, response);
  });

});

/*
 * Tests retrieving the token, owner, wallet, rate, weiRaised, and buying of tokens in the Crowdsale.sol contract
 */

describe("Tests the Crowdsale.sol functionality", async ()=> {
  // token()
  it('Returns the tokens address', async ()=> {
    const tokenAddress = await sampleCrowdsaleContract.methods.token().call();

    assert.equal(lightstreamTokenAddress, tokenAddress);
  });

  // owner()
  it('Returns the owners address', async ()=> {
    const ownerAddress = await sampleCrowdsaleContract.methods.owner().call();

    assert.equal(accounts[0], ownerAddress);
  });

  // wallet()
  it('Returns the wallet adddress', async ()=> {
    const returnedWalletAdress = await sampleCrowdsaleContract.methods.wallet().call();

    assert.equal(walletAdress, returnedWalletAdress)
  });

  // rate()
  it('Returns the rate information', async ()=> {
    const rate = await sampleCrowdsaleContract.methods.rate().call();

    assert.equal(2733, rate);
  });

  // buyTokens(address)
  it('Allows for purchase of newly created token', async ()=> {
    // Travel ahead two days so the sale is open
    await timeTravel(3600 * 24 * 2);

    // convert ether to a Big Number so web3 doesn't complain
    const etherInWei = web3.utils.toWei('1', 'ether');
    const purchaseAmount = web3.utils.toBN(etherInWei);

    try {
      await sampleCrowdsaleContract.methods.addAddressToWhitelist(accounts[1]).send({
        from: accounts[0],
        gas: '4712388'
      });

      const isWhitelisted = await sampleCrowdsaleContract.methods.whitelist(accounts[1]).call();
      printData('isWhitelisted', isWhitelisted);

      const openingTime = await sampleCrowdsaleContract.methods.openingTime().call();
      printData('openingTime', openingTime);

      const now = await sampleCrowdsaleContract.methods.returnNow().call();
      printData('now', now);

      const purchaseTransaction = await sampleCrowdsaleContract.methods.buyTokens(accounts[1]).send({
        from: accounts[1],
        value: purchaseAmount,
        gas: '4712388'
      });

      printData('purchaseTransaction', purchaseTransaction.events);

    } catch (error) {
      printData('purchaseTransaction - error', error.results);
    }
  });

    // mintAndVest(address _beneficiary, uint256 _tokens, uint256 _bonus)
  it('Allows the owner to mint tokens for pre-sale collected in USD', async ()=> {
      // The amount needs to be an integer.  PTH has 18 decimals so it's the same as converting Eth to Wei
      const pthInWei = web3.utils.toWei('6000000', 'ether');
      const mintAmount = web3.utils.toBN(pthInWei);

      const bonusInWei = web3.utils.toWei('100000', 'ether');
      const bonusAmount = web3.utils.toBN(bonusInWei);

      try {
        await sampleCrowdsaleContract.methods.addAddressToWhitelist(accounts[2]).send({ from: accounts[0], gas: '4712388' });

        const mintAndVest  = await sampleCrowdsaleContract.methods.mintAndVest(accounts[2], mintAmount, bonusAmount).send({ from: accounts[0], gas: '4712388' });

        printData('mintAndVest', mintAndVest.events);

      } catch(error){
        printData('mintAndVest - error', error);
      }
  });

  // weiRaised()
  it('Returns the the amount of Wei raised', async ()=> {
    const weiRaised = await sampleCrowdsaleContract.methods.weiRaised().call();

    assert.equal(1000000000000000000, weiRaised);
  });

  // updateRate(uint256)
  it('Will not update the rate if it is over 10 percent of the initial rate', async ()=> {
    const pthInWei = web3.utils.toWei('3500', 'ether');
    const bigNumber = web3.utils.toBN(pthInWei);

    try{
      await sampleCrowdsaleContract.methods.updateRate(bigNumber).send({ from: accounts[0], gas: '4712388' });
      assert.equal(true, false);
    } catch(error) {
      assert.equal(true, true);
    }
  });

  // updateRate(uint256)
  it('Will not update the rate if it is under 10 percent of the initial rate', async ()=> {
    const pthInWei = web3.utils.toWei('2000', 'ether');
    const bigNumber = web3.utils.toBN(pthInWei);

    try{
      await sampleCrowdsaleContract.methods.updateRate(bigNumber).send({ from: accounts[0], gas: '4712388' });
      assert.equal(true, false);
    } catch(error) {
      assert.equal(true, true);
    }
  });

  // updateRate(uint256)
  it('Will update the rate if it is within 10 percent of the initial rate', async ()=> {

    try{
      await sampleCrowdsaleContract.methods.updateRate('3000').send({ from: accounts[0], gas: '4712388' });
      const rate = await sampleCrowdsaleContract.methods.rate().call();
      printData('newRate', rate);
    } catch(error) {
      assert.equal(true, false);
    }
  });

  // ownerAddressToVestingContractAddress(address)
  it.skip("Returns the vesting contract address of the beneficiary", async ()=> {
    vestingContractAddress = await sampleCrowdsaleContract.methods.ownerAddressToVestingContractAddress(accounts[1]).call();
  });

});


/*
 * Tests retrieving the token, owner, wallet, rate, weiRaised, and buying of tokens in the Crowdsale.sol contract
 */

describe.skip("Test TokenVesting.sol functionality", async ()=> {
  let releaseableAmount;

  before(async ()=> {
    // create an instance of the vesting contract with the vesting contract address
    vestingContact = new web3.eth.Contract(tokenVestingAbi, vestingContractAddress);

    // Travel three months into the future for testing
    timeTravel(3600 * 24 * 30 * 3);

    await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336
  });

  // releasableAmount()
  it('The vesting contract returns the releaseable Amount', async ()=> {
    releaseableAmount = await vestingContact.methods.releasableAmount().call();
  });

  // vestedAmount
  it('Returns the vestedAmount', async ()=> {
    const vestedAmount = await vestingContact.methods.vestedAmount().call();
  });

  // startTimestamp
  it('Returns the startTimestamp', async ()=> {
    const startTimestamp = await vestingContact.methods.startTimestamp().call();
    assert.equal(1535760000, startTimestamp);
  });

  // startTimestamp
  it('Returns the endTimestamp', async ()=> {
    const endTimestamp = await vestingContact.methods.endTimestamp().call();
    assert.equal(1551312000, endTimestamp);
  });

  // lockPeriod
  it('Returns the lockPeriod', async ()=> {
    const lockPeriod = await vestingContact.methods.lockPeriod().call();
    assert.equal(2592000, lockPeriod);
  });

  // release
  it('The releases the amount vested', async ()=> {
    try{
      const release = await vestingContact.methods.release().send({ from: accounts[1], gas: '4712388' });
    } catch(error) {
      printData('error', error);
    }
  });

  // released
  it('The released', async ()=> {
    const released = await vestingContact.methods.released().call();
    printData('released', released);
  });
});


/*
 * Tests the team distribution contract for setting, and revoking allocations
 */

describe("Tests the distribution contract", async ()=> {
  let vestingContractAddress;

  before(async()=> {
    try {
      // Travel three months into the future for testing
      timeTravel(3600 * 24 * 30 * 3);

      await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336

      await sampleCrowdsaleContract.methods.finalize().send({ from: accounts[0], gas: '4712388' });
    } catch(error){
      printData('finalize -- error', error);
    }

    await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336
  });

  it("Has the Lightstream token in it", async ()=> {
    const balance = await lightstreamTokenContract.methods.balanceOf(distributionContractAddress).call();
  });

  // setAllocation (address _beneficiary, uint256 _totalAllocated, AllocationType _supply)
  it("Is able to set an allocation", async ()=> {

    // Convert PTH to Big Number format
    const accountFourPHT = web3.utils.toWei('15424000', 'ether');
    const acountFivePHT = web3.utils.toWei('10000000', 'ether');

    const fourBigNumber = web3.utils.toBN(accountFourPHT);
    const fiveBigNumber = web3.utils.toBN(acountFivePHT);

    try {
      const owner = await distributionContract.methods.owner().call();

      await distributionContract.methods.setAllocation(accounts[4], fourBigNumber, 0).send({ from: accounts[0], gas: '4712388' });
      await distributionContract.methods.setAllocation(accounts[5], fiveBigNumber, 0).send({ from: accounts[0], gas: '4712388' });
    } catch(error){
      printData('Error - Is able to set an allocation', error);
    }
  });

  it("Returns the allocation data", async ()=> {
    printData('distributionContract', distributionContract.options.address);
    const allocationData = await distributionContract.methods.getAllocationData(accounts[4]).call();
    //printData('allocationData', allocationData);
  });

  it("Returns the balance for the team supply", async ()=> {
    const teamSupply = await distributionContract.methods.AVAILABLE_TEAM_SUPPLY().call();

    assert.equal(40000000000000000000000000, teamSupply);
  });

  it("Releases the PHT to the team members wallet", async ()=> {
    // Travel 3 months into the future for testing
    await timeTravel(3600 * 24 * 30 * 3);

    await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336

    const releaseTransaction = await distributionContract.methods.release(accounts[4]).send({ from: accounts[0], gas: '4712388' });

    //printData('releaseTransaction', releaseTransaction.events.LogUint);
  });

  // revoke (address _beneficiary)
  it("Is able to revoke an allocation", async ()=> {
    try {
      const revoke = await distributionContract.methods.revokeAllocation(accounts[5]).send({ from: accounts[0], gas: '4712388' });

      //printData('revoke', revoke.events.LogUint);
    } catch(error){
      printData('Error - revokeAllocation', error);
    }
  });


});


/*
 * Tests the distribution of PTH and ETH to the beneficiary, investor's, and team member wallet
 */

describe("The investors's wallet", async ()=> {
  it("Has the right amount of the Lightstream token in it", async ()=> {
    const lightstreamBalance = await lightstreamTokenContract.methods.balanceOf(accounts[1]).call();

    assert.equal(3279600000000000000000, lightstreamBalance);
  });
});

describe("The beneficiary's wallet", async ()=> {
  it("Has the correct amount of ETH in it", async ()=> {
    const ethBalance = await web3.eth.getBalance(accounts[9]);

    assert.equal(101000000000000000000, ethBalance);
  });
});

describe("The team member's wallet", async ()=> {

  it("Has the correct amount of PTH in it from release", async ()=> {
    const lightstreamBalance = await lightstreamTokenContract.methods.balanceOf(accounts[4]).call();

    assert.equal(1928000000000000000000000, lightstreamBalance);
  });

  it("Has the correct amount of PTH in it from revoke", async ()=> {
    const lightstreamBalance = await lightstreamTokenContract.methods.balanceOf(accounts[5]).call();

    assert.equal(1249999999999999999999998, lightstreamBalance);
    printData('lightstreamBalance - Account 5', lightstreamBalance);
  });
});

describe("The project wallet", async ()=> {
  it("The OTHER pool has the correct amount of PTH in it from revoke", async ()=> {
    const otherSupply = await distributionContract.methods.AVAILABLE_OTHER_SUPPLY().call();

    printData('lightstreamBalance - otherSupply', otherSupply);
  });
});

describe("Bonuses", async ()=> {
  // setBonus(_address, _bonus)
  it("Can set a bonus", async ()=> {
    const setBonus = await sampleCrowdsaleContract.methods.setBonus(accounts[8], 3000).send({ from: accounts[0], gas: '4712388' });

    printData('setBonus', setBonus);
  });

  it("Can get the bonus set for an address", async ()=> {
    const setBonus = await sampleCrowdsaleContract.methods.getBonus(accounts[8]).call();

    printData('setBonus', setBonus);
  });

  it("Contributor receives allocated bonus", async ()=> {
    await sampleCrowdsaleContract.methods.addAddressToWhitelist(accounts[8]).send({ from: accounts[0], gas: '4712388' });

    // convert ether to a Big Number so web3 doesn't complain
    const etherInWei = web3.utils.toWei('1', 'ether');
    const purchaseAmount = web3.utils.toBN(etherInWei);

    const now = await sampleCrowdsaleContract.methods.returnNow().call();
    printData('now', now);

    const closingTime = await sampleCrowdsaleContract.methods.closingTime().call();
    printData('closingTime', closingTime);
  });
});

describe("Vesting", async ()=> {
  // getVestingSchedule(_address)
  it("Gets the vesting schedule for a ", async ()=> {
    const getVestingSchedule = await sampleCrowdsaleContract.methods.getVestingSchedule(accounts[2]).call();

    printData('getVestingSchedule', getVestingSchedule);
  });
});


describe("Escrow", async ()=> {
  // mintAndEscrow(_address)
  it("Creates an escrow for a contributor", async ()=> {
    // The amount needs to be an integer.  PTH has 18 decimals so it's the same as converting Eth to Wei
    const pthInWei = web3.utils.toWei('6000000', 'ether');
    const mintAmount = web3.utils.toBN(pthInWei);

    const bonusInWei = web3.utils.toWei('100000', 'ether');
    const bonusAmount = web3.utils.toBN(bonusInWei);

    const mintAndEscrow = await sampleCrowdsaleContract.methods.mintAndEscrow(accounts[7], mintAmount, bonusAmount).send({ from: accounts[0], gas: '4712388' });

    printData('mintAndEscrow', mintAndEscrow);
  });

  // getEscrowData(address)
  it("Returns the data of an escrow for a user", async ()=> {
    const getEscrowData = await sampleCrowdsaleContract.methods.getEscrowData(accounts[7]).call();

    printData('getEscrowData', getEscrowData);
  });

  // refund(address)
  it("Refunds the contributor", async ()=> {
    const refund = await sampleCrowdsaleContract.methods.refund(accounts[7]).send({ from: accounts[0], gas: '4712388' });

    printData('refund', refund);
  });
});














//   'checkRole(address,string)'
//   'ROLE_WHITELISTED()' 
//   'hasRole(address,string)' 
//   'renounceOwnership()'


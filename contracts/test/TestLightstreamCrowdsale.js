let LightstreamToken = artifacts.require("LightstreamToken");
let TeamDistribution = artifacts.require("distribution/TeamDistribution");
let LightstreamCrowdsale = artifacts.require("LightstreamCrowdsale");


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

const convertFromBnToInt = function(bn) {
  return Number(web3._extend.utils.fromWei(bn.toNumber(), 'ether'));
}

const convertEtherToWeiBN = function(ether) {
  const etherInWei = web3._extend.utils.toWei(ether, 'ether');
  return web3._extend.utils.toBigNumber(etherInWei);
}

const RATE = 1000;

const VESTING_SCHEDULE = {
    startTimestamp: 0,
    endTimestamp: 1,
    lockPeriod: 2,
    initialAmount: 3,
    amountClaimed: 4,
    balance: 5,
    bonus: 6,
    revocable: 7,
    revoked: 8
  };

contract('Crowdsale', async (accounts)=> {
  const OWNER_ACCOUNT =         accounts[0];
  const CONTRIBUTOR_1_ACCOUNT = accounts[1];
  const CONTRIBUTOR_2_ACCOUNT = accounts[2];
  const CONTRIBUTOR_3_ACCOUNT = accounts[3];
  const CONTRIBUTOR_4_ACCOUNT = accounts[4];
  const CONTRIBUTOR_5_ACCOUNT = accounts[5];
  const CONTRIBUTOR_6_ACCOUNT = accounts[6];
  const MINT_ACCOUNT_1 =        accounts[7];
  const MINT_ACCOUNT_2 =        accounts[8];
  const MINT_ACCOUNT_3 =        accounts[9];

  it('should deploy the token and store the address', async ()=> {
    const tokenInstance = await LightstreamToken.deployed();

    assert(tokenInstance.address, 'Token address couldn\'t be stored');
  });

  it('should transfer the ownership of token to the crowdsale contract so it can mint tokens', async ()=> {
    const tokenInstance = await LightstreamToken.deployed();
    const transferOwnership = await tokenInstance.transferOwnership(LightstreamCrowdsale.address);
    const owner = await tokenInstance.owner();

    assert.equal(LightstreamCrowdsale.address, owner, 'The owner of the token was not updated to the crowdsale contact');
  });

  it('The owner should be able to add an address to the whitelist', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const transaction = await crowdsaleInstance.addAddressToWhitelist(CONTRIBUTOR_1_ACCOUNT);
    const whitelisted = await crowdsaleInstance.whitelist(CONTRIBUTOR_1_ACCOUNT);
    assert(whitelisted, 'Address not added to whitelist');
  });

  it('The owner should be able to add multiple addresses to the whitelist', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const transaction = await crowdsaleInstance.addAddressesToWhitelist([CONTRIBUTOR_2_ACCOUNT, CONTRIBUTOR_3_ACCOUNT,
                                                                        CONTRIBUTOR_4_ACCOUNT, CONTRIBUTOR_5_ACCOUNT, CONTRIBUTOR_6_ACCOUNT]);
    const whitelisted2 = await crowdsaleInstance.whitelist(CONTRIBUTOR_2_ACCOUNT);
    const whitelisted3 = await crowdsaleInstance.whitelist(CONTRIBUTOR_3_ACCOUNT);
    const whitelisted4 = await crowdsaleInstance.whitelist(CONTRIBUTOR_4_ACCOUNT);
    const whitelisted5 = await crowdsaleInstance.whitelist(CONTRIBUTOR_5_ACCOUNT);
    const whitelisted6 = await crowdsaleInstance.whitelist(CONTRIBUTOR_6_ACCOUNT);

    assert(whitelisted2, 'Address 2 not added to whitelist');
    assert(whitelisted3, 'Address 3 not added to whitelist');
    assert(whitelisted4, 'Address 4 not added to whitelist');
    assert(whitelisted5, 'Address 5 not added to whitelist');
    assert(whitelisted6, 'Address 6 not added to whitelist');
  });

  it('Only the owner should be able to add an address to the whitelist', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    try {
      const transaction = await crowdsaleInstance.addAddressToWhitelist(CONTRIBUTOR_1_ACCOUNT, {from: CONTRIBUTOR_1_ACCOUNT});
      assert.equal(true, false);
    } catch(error) {
      assert(error);
    }
  });

  it('The owner should be able to update the rate at which tokens are minted per wei sent in', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();

      const updateRate = await crowdsaleInstance.updateRate(RATE, {from: OWNER_ACCOUNT});
      const updatedRateBN = await crowdsaleInstance.rate.call();
      const updatedRate = updatedRateBN.toNumber();

      assert.equal(RATE, updatedRate);
  });

  it('The owner should not be able to update the rate more than 10 percent up', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();

      try {
        const updateRate = await crowdsaleInstance.updateRate(RATE * 1.11, {from: OWNER_ACCOUNT});
        assert.equal(true, false);
      } catch(error){
        assert(error);
      }
  });

  it('The owner should not be able to update the rate more than 10 percent lower', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();

      try {
        const updateRate = await crowdsaleInstance.updateRate(RATE * .89, {from: OWNER_ACCOUNT});
        assert.equal(true, false);
      } catch(error){
        assert(error);
      }
  });

  it('Only the owner should be able to update the rate at which tokens are minted per wei sent in', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();

    try {
      const transaction = await crowdsaleInstance.updateRate(RATE, {from: CONTRIBUTOR_2_ACCOUNT });
      assert.equal(true, false);
    } catch(error) {
      assert(error);
    }
  });

  it('An address on the whitelist and purchasing in the first 2 days should get a 30 percent bonus', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const etherInBn = convertEtherToWeiBN(1);

    // Time travel one day into the future so the sale has started
    const timeTravelTransaction = await timeTravel(3600 * 24 * 1);
    const mineBlockTransaction = await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336

    const buyTokens = await crowdsaleInstance.buyTokens(CONTRIBUTOR_1_ACCOUNT, {from: CONTRIBUTOR_1_ACCOUNT, value: etherInBn });
    // Get the balance of PHT the crowd sales contract holds
    const contractBalanceBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalance = convertFromBnToInt(contractBalanceBN);
    // Get the vesting schedule of the address
    const vestingSchedule = await crowdsaleInstance.vestingSchedules(CONTRIBUTOR_1_ACCOUNT);
    const vestedInitialAmount = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.initialAmount]);
    const vestedBonus = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.bonus]);

    assert.equal(1300, contractBalance);
    assert.equal(1000, vestedInitialAmount);
    assert.equal(300, vestedBonus);
  });

  it('The owner should be able mint an initial amount and bonus for a whitelisted address', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    // 333000 is the min and 13.5 million is the max
    const initialPurchase = convertEtherToWeiBN(500000);
    const bonus = convertEtherToWeiBN(100000);

    const contractBalanceBeforeBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalanceBefore = convertFromBnToInt(contractBalanceBeforeBN);

    const mintAndVest = await crowdsaleInstance.mintAndVest(MINT_ACCOUNT_1, initialPurchase, bonus);
    // Get the balance of PHT the crowd sales contract holds
    const contractBalanceAfterBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalanceAfter = convertFromBnToInt(contractBalanceAfterBN);
    // Get the vesting schedule of the address
    const vestingSchedule = await crowdsaleInstance.vestingSchedules(MINT_ACCOUNT_1);
    const vestedInitialAmount = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.initialAmount]);
    const vestedBonus = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.bonus]);

    assert.equal(contractBalanceBefore + vestedInitialAmount + vestedBonus, contractBalanceAfter);
    assert.equal(500000, vestedInitialAmount);
    assert.equal(100000, vestedBonus);
  });

  it('The owner should be not be able to mint an initial amount and bonus for a whitelisted address that has a vesting schedule', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    // 333000 is the min and 13.5 million is the max
    const initialPurchase = convertEtherToWeiBN(500000);
    const bonus = convertEtherToWeiBN(100000);

    try {
      const mintAndVest = await crowdsaleInstance.mintAndVest(MINT_ACCOUNT_1, initialPurchase, bonus);
      assert(true, false);
    } catch(error){
      assert(error);
    }
  });

  it('The owner should be not be able to mint an initial amount less than the minimum', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    // 333000 is the min and 13.5 million is the max
    const initialPurchase = convertEtherToWeiBN(300000);
    const bonus = convertEtherToWeiBN(100000);

    try {
      const mintAndVest = await crowdsaleInstance.mintAndVest(MINT_ACCOUNT_2, initialPurchase, bonus);
      assert(true, false);
    } catch(error){
      assert(error);
    }
  });

  it('The owner should be not be able to mint an initial amount greater than the maximum', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    // 333000 is the min and 13.5 million is the max
    const initialPurchase = convertEtherToWeiBN(14000000);
    const bonus = convertEtherToWeiBN(100000);

    try {
      const mintAndVest = await crowdsaleInstance.mintAndVest(MINT_ACCOUNT_2, initialPurchase, bonus);
      assert(true, false);
    } catch(error){
      assert(error);
    }
  });

  it('An address on the whitelist and purchasing between day 3 and 4 should get a 20 percent bonus', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const etherInBn = convertEtherToWeiBN(1);

    // Time travel one day into the future so the sale has started
    const timeTravelTransaction = await timeTravel(3600 * 24 * 2);
    const mineBlockTransaction = await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336

    const contractBalanceBeforeBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalanceBefore = convertFromBnToInt(contractBalanceBeforeBN);

    const buyTokens = await crowdsaleInstance.buyTokens(CONTRIBUTOR_2_ACCOUNT, {from: CONTRIBUTOR_2_ACCOUNT, value: etherInBn });
    // Get the balance of PHT the crowd sales contract holds
    const contractBalanceAfterBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalanceAfter = convertFromBnToInt(contractBalanceAfterBN);
    // Get the vesting schedule of the address
    const vestingSchedule = await crowdsaleInstance.vestingSchedules(CONTRIBUTOR_2_ACCOUNT);
    const vestedInitialAmount = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.initialAmount]);
    const vestedBonus = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.bonus]);

    assert.equal(contractBalanceBefore + vestedInitialAmount + vestedBonus, contractBalanceAfter);
    assert.equal(1000, vestedInitialAmount);
    assert.equal(200, vestedBonus);
  });

  it('An address on the whitelist and purchasing between day 4 and 6 should get a 10 percent bonus', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const etherInBn = convertEtherToWeiBN(1);

    // Time travel one day into the future so the sale has started
    const timeTravelTransaction = await timeTravel(3600 * 24 * 2);
    const mineBlockTransaction = await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336

    const contractBalanceBeforeBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalanceBefore = convertFromBnToInt(contractBalanceBeforeBN);

    const buyTokens = await crowdsaleInstance.buyTokens(CONTRIBUTOR_3_ACCOUNT, {from: CONTRIBUTOR_3_ACCOUNT, value: etherInBn });
    // Get the balance of PHT the crowd sales contract holds
    const contractBalanceAfterBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalanceAfter = convertFromBnToInt(contractBalanceAfterBN);
    // Get the vesting schedule of the address
    const vestingSchedule = await crowdsaleInstance.vestingSchedules(CONTRIBUTOR_3_ACCOUNT);
    const vestedInitialAmount = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.initialAmount]);
    const vestedBonus = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.bonus]);

    assert.equal(contractBalanceBefore + vestedInitialAmount + vestedBonus, contractBalanceAfter);
    assert.equal(1000, vestedInitialAmount);
    assert.equal(100, vestedBonus);
  });

  it('An address on the whitelist and purchasing between day 6 and 8 should get a 5 percent bonus', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const etherInBn = convertEtherToWeiBN(1);

    // Time travel one day into the future so the sale has started
    const timeTravelTransaction = await timeTravel(3600 * 24 * 2);
    const mineBlockTransaction = await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336

    const contractBalanceBeforeBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalanceBefore = convertFromBnToInt(contractBalanceBeforeBN);

    const buyTokens = await crowdsaleInstance.buyTokens(CONTRIBUTOR_4_ACCOUNT, {from: CONTRIBUTOR_4_ACCOUNT, value: etherInBn });
    // Get the balance of PHT the crowd sales contract holds
    const contractBalanceAfterBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalanceAfter = convertFromBnToInt(contractBalanceAfterBN);
    // Get the vesting schedule of the address
    const vestingSchedule = await crowdsaleInstance.vestingSchedules(CONTRIBUTOR_4_ACCOUNT);
    const vestedInitialAmount = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.initialAmount]);
    const vestedBonus = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.bonus]);

    assert.equal(contractBalanceBefore + vestedInitialAmount + vestedBonus, contractBalanceAfter);
    assert.equal(1000, vestedInitialAmount);
    assert.equal(50, vestedBonus);
  });

  it('An address on the whitelist and purchasing after day 8 should not get a bonus', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const etherInBn = convertEtherToWeiBN(1);

    // Time travel one day into the future so the sale has started
    const timeTravelTransaction = await timeTravel(3600 * 24 * 2);
    const mineBlockTransaction = await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336

    const contractBalanceBeforeBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalanceBefore = convertFromBnToInt(contractBalanceBeforeBN);

    const buyTokens = await crowdsaleInstance.buyTokens(CONTRIBUTOR_5_ACCOUNT, {from: CONTRIBUTOR_5_ACCOUNT, value: etherInBn });
    // Get the balance of PHT the crowd sales contract holds
    const contractBalanceAfterBN = await tokenInstance.balanceOf(LightstreamCrowdsale.address);
    const contractBalanceAfter = convertFromBnToInt(contractBalanceAfterBN);
    // Get the vesting schedule of the address
    const vestingSchedule = await crowdsaleInstance.vestingSchedules(CONTRIBUTOR_5_ACCOUNT);
    const vestedInitialAmount = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.initialAmount]);
    const vestedBonus = convertFromBnToInt(vestingSchedule[VESTING_SCHEDULE.bonus]);

    assert.equal(contractBalanceBefore + vestedInitialAmount + vestedBonus, contractBalanceAfter);
    assert.equal(1000, vestedInitialAmount);
    assert.equal(0, vestedBonus);
  });

  it('An address that has already purchased tokens should not be able to purcahse again', async ()=> {
    const crowdsaleInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const etherInBn = convertEtherToWeiBN(1);

    try {
      const buyTokens = await crowdsaleInstance.buyTokens(CONTRIBUTOR_5_ACCOUNT, {from: CONTRIBUTOR_5_ACCOUNT, value: etherInBn });
      assert.equal(true, false);
    } catch(error){
      assert(error);
    }
  });
});
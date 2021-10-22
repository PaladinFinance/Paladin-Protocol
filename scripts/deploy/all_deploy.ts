const hre = require("hardhat");

const ethers = hre.ethers;

const network = hre.network.name;

const params_path = () => {
  if (network === 'kovan') {
    return '../utils/kovan_params'
  }
  else if (network === 'rinkeby') {
    return '../utils/rinkeby_params'
  }
  else {
    return '../utils/main_params'
  }
}

const param_file_path = params_path();

const { 
  POOLS_PARAMS,
  TOKENS,
  DELEGATOR_NAMES,
  PAL_LOAN_TOKEN_URI,
  MULTIPLIER_CONTRACTS,
  MULTIPLIER_NAMES,
  INTEREST_MODULE_VALUES,
  MULTIPLIER_KEYS
} = require(param_file_path);

let pools: String[] = [];
let tokens: String[] = [];
let underlyings: String[] = [];

let delegators: { [name: string]: string } = {};

let multipliers_pools: { [name: string]: string[] } = {};
let multipliers_address: { [name: string]: string } = {};

let palPools: { [name: string]: { [name: string]: string } } = {};

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

async function main() {

  const deployer = (await hre.ethers.getSigners())[0];



  const Controller = await ethers.getContractFactory("PaladinController");
  const Interest = await ethers.getContractFactory("InterestCalculatorV2");
  const PalLoanToken = await ethers.getContractFactory("PalLoanToken");
  const BurnedPalLoanToken = await ethers.getContractFactory("BurnedPalLoanToken");
  const Registry = await ethers.getContractFactory("AddressRegistry");
  const PalPool = await ethers.getContractFactory("PalPool");
  const PalToken = await ethers.getContractFactory("PalToken");

  //variant pools :
  const stkAavePalPool = await ethers.getContractFactory("PalPoolStkAave");

  //multipliers : 
  const GovernorMultiplier = await ethers.getContractFactory("GovernorMultiplier");
  const AaveMultiplier = await ethers.getContractFactory("AaveMultiplier");


  console.log('Deploying the Paladin Controller ...')
  const controller = await Controller.deploy();

  await controller.deployTransaction.wait(5);

  console.log('Deploying the Interest Calculator Module V2 ...')
  const interest = await Interest.deploy();



  await Promise.all([
    controller.deployed(),
    interest.deployed(),
  ]);



  console.log('Deploying PalLoanToken (ERC721) contract ...')
  const loanToken = await PalLoanToken.deploy(controller.address, PAL_LOAN_TOKEN_URI);
  await loanToken.deployed();



  for (let d in DELEGATOR_NAMES) {
    let Delegator = await ethers.getContractFactory(DELEGATOR_NAMES[d]);
    console.log('Deploying Delegator ' + DELEGATOR_NAMES[d] + ' ...')
    const delegator = await Delegator.deploy();
    await delegator.deployed();

    delegators[d] = delegator.address;

    //await delegator.deployTransaction.wait(5);
  }

  for(let m in MULTIPLIER_KEYS){
    multipliers_pools[m] = []
  }

  for (let p in POOLS_PARAMS) {
    let params = POOLS_PARAMS[p];

    console.log('Deploying PalToken ' + params.SYMBOL + ' ...')
    let palToken = await PalToken.deploy(params.NAME, params.SYMBOL);
    await palToken.deployed();

    //await palToken.deployTransaction.wait(5);


    let palPool;
    console.log('Deploying PalPool ' + params.SYMBOL + ' ...')
    if (params.SYMBOL === 'palStkAAVE') {
      palPool = await stkAavePalPool.deploy(
        palToken.address,
        controller.address,
        params.UNDERLYING,
        interest.address,
        delegators[params.DELEGATOR],
        loanToken.address,
        TOKENS.AAVE
      );
    }
    else {
      palPool = await PalPool.deploy(
        palToken.address,
        controller.address,
        params.UNDERLYING,
        interest.address,
        delegators[params.DELEGATOR],
        loanToken.address
      );
    }
    await palPool.deployed();

    //await palPool.deployTransaction.wait(5);

    let initiate_tx = await palToken.initiate(palPool.address)

    await initiate_tx.wait(5);

    pools.push(palPool.address)
    tokens.push(palToken.address)
    underlyings.push(params.UNDERLYING)

    multipliers_pools[params.MUTIPLIER].push(palPool.address)

    palPools[p] = {
      'pool': palPool.address,
      'token': palToken.address,
      'symbol': params.SYMBOL
    }

    await delay(30000);

  }

  const tx = await controller.setInitialPools(tokens, pools);

  await tx.wait(15);

  //deploy mutipliers
  console.log('Deploying Multipliers ...')

  for(let m in MULTIPLIER_KEYS){
    console.log('Deploying Multiplier' + m + ' ...')
    let mult_data = MULTIPLIER_KEYS[m]
    let multiplier: any

    if(mult_data.NAME == MULTIPLIER_NAMES.GOVERNOR){
      multiplier = await GovernorMultiplier.deploy(
        mult_data.GOVERNOR_ADDRESS,
        multipliers_pools[m]
      )
    }
    else if(mult_data.NAME == MULTIPLIER_NAMES.AAVE){
      multiplier = await AaveMultiplier.deploy(
        mult_data.GOVERNANCE_ADDRESS,
        mult_data.STRATEGY_ADDRESS,
        multipliers_pools[m]
      )
    }
    await multiplier.deployed();
    multipliers_address[m] = multiplier.address;

    await multiplier.deployTransaction.wait(5);
  }



  console.log('Deploying the Address Registry ...')
  const registry = await Registry.deploy(
    controller.address,
    loanToken.address,
    underlyings,
    pools,
    tokens
  );
  await registry.deployed();

  await registry.deployTransaction.wait(5);

  //initiate interest module

  let mult_list:String[] = [];
  let pool_list:String[] = [];
  for(let m in multipliers_pools){
    for(let p in multipliers_pools[m]){
      mult_list.push(multipliers_address[m]);
      pool_list.push(multipliers_pools[m][p]);
    }
  }

  console.log('Initiating the Interest Module ...')
  await interest.initiate(
    INTEREST_MODULE_VALUES.MULTIPLIER_PER_YEAR,
    INTEREST_MODULE_VALUES.BASE_RATE_PER_YEAR,
    INTEREST_MODULE_VALUES.JUMP_MULTIPLIER_PER_YEAR,
    pool_list,
    mult_list
  )



  await controller.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    address: controller.address,
    constructorArguments: [],
  });
  console.log()
  await interest.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    address: interest.address,
    constructorArguments: [],
  });
  console.log()
  await loanToken.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    address: loanToken.address,
    constructorArguments: [controller.address, PAL_LOAN_TOKEN_URI],
  });
  console.log()
  await registry.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    address: registry.address,
    constructorArguments: [
      controller.address,
      loanToken.address,
      underlyings,
      pools,
      tokens
    ],
  });
  console.log()
  for (let d in delegators) {
    await hre.run("verify:verify", {
      address: delegators[d],
      constructorArguments: [],
      contract: "contracts/delegators/"+DELEGATOR_NAMES[d]+".sol:"+DELEGATOR_NAMES[d]
    });
    console.log()
  }
  for (let m in multipliers_address) {
    if(MULTIPLIER_CONTRACTS[m].NAME == MULTIPLIER_NAMES.GOVERNOR){
      await hre.run("verify:verify", {
        address: multipliers_address[m],
        constructorArguments: [
          MULTIPLIER_CONTRACTS[m].GOVERNOR_ADDRESS,
          multipliers_pools[m]
        ]
      });
      console.log()
    }
    else if(MULTIPLIER_CONTRACTS[m].NAME == MULTIPLIER_NAMES.AAVE){
      await hre.run("verify:verify", {
        address: multipliers_address[m],
        constructorArguments: [
          MULTIPLIER_CONTRACTS[m].GOVERNANCE_ADDRESS,
          MULTIPLIER_CONTRACTS[m].STRATEGY_ADDRESS,
          multipliers_pools[m]
        ]
      });
      console.log()
    }
  }
  console.log()
  for (let p in palPools) {
    await hre.run("verify:verify", {
      address: palPools[p]['token'],
      constructorArguments: [
        POOLS_PARAMS[p].NAME,
        POOLS_PARAMS[p].SYMBOL
      ],
    });
    console.log()
    if (palPools[p]['symbol'] === 'palStkAAVE') {
      await hre.run("verify:verify", {
        address: palPools[p]['pool'],
        constructorArguments: [
          palPools[p]['token'],
          controller.address,
          POOLS_PARAMS[p].UNDERLYING,
          interest.address,
          delegators[POOLS_PARAMS[p].DELEGATOR],
          loanToken.address,
          TOKENS.AAVE
        ],
      });
      console.log()
    }
    else {
      await hre.run("verify:verify", {
        address: palPools[p]['pool'],
        constructorArguments: [
          palPools[p]['token'],
          controller.address,
          POOLS_PARAMS[p].UNDERLYING,
          interest.address,
          delegators[POOLS_PARAMS[p].DELEGATOR],
          loanToken.address
        ],
      });
      console.log()
    }
  }

  console.log('Controller : ')
  console.log(controller.address)
  console.log()
  console.log('Interest Calculator : ')
  console.log(interest.address)
  console.log()
  console.log('PalLoanToken : ')
  console.log(loanToken.address)
  console.log()
  console.log('Address Registry : ')
  console.log(registry.address)
  console.log()
  for (let d in delegators) {
    console.log(DELEGATOR_NAMES[d] + ' : ')
    console.log(delegators[d])
  }
  console.log()
  for (let m in multipliers_address) {
    console.log(MULTIPLIER_CONTRACTS[m].NAME + ' (' + MULTIPLIER_CONTRACTS[m].GOV + ' Governance)' + ' : ')
    console.log(multipliers_address[m])
  }
  console.log()
  for (let p in palPools) {
    console.log(palPools[p]['symbol'])
    console.log('PalPool :  ' + palPools[p]['pool'])
    console.log('PalToken :  ' + palPools[p]['token'])
  }


  console.log()
  console.log()
  console.log()

  const burnedLoanTokenAddress = await loanToken.burnedToken()
  const burnedLoanToken = BurnedPalLoanToken.attach(burnedLoanTokenAddress)
  await hre.run("verify:verify", {
    address: burnedLoanToken.address,
    constructorArguments: ["burnedPalLoan Token", "bPLT"],
  });

}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
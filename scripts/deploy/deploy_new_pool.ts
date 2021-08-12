export { };
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

const { POOLS_PARAMS, TOKENS, DELEGATORS, CONTROLLER, INTEREST_MODULE_V2, PAL_LOAN_TOKEN } = require(param_file_path);


const KEY = 'COMP'


async function main() {

  const deployer = (await hre.ethers.getSigners())[0];

  const PalPool = await ethers.getContractFactory("PalPool");
  const PalToken = await ethers.getContractFactory("PalToken");

  //variant pools :
  const stkAavePalPool = await ethers.getContractFactory("PalPoolStkAave");



  const params = POOLS_PARAMS[KEY];

  console.log('Deploying PalToken ' + params.SYMBOL + ' ...')
  const palToken = await PalToken.deploy(params.NAME, params.SYMBOL);
  await palToken.deployed();


  let palPool;
  console.log('Deploying PalPool ' + params.SYMBOL + ' ...')
  if (params.SYMBOL === 'palStkAAVE') {
    palPool = await stkAavePalPool.deploy(
      palToken.address,
      CONTROLLER,
      params.UNDERLYING,
      INTEREST_MODULE_V2,
      DELEGATORS[params.DELEGATOR],
      PAL_LOAN_TOKEN,
      TOKENS.AAVE
    );
  }
  else {
    palPool = await PalPool.deploy(
      palToken.address,
      CONTROLLER,
      params.UNDERLYING,
      INTEREST_MODULE_V2,
      DELEGATORS[params.DELEGATOR],
      PAL_LOAN_TOKEN
    );
  }
  await palPool.deployed();


  await palToken.initiate(palPool.address)


  await palPool.deployTransaction.wait(30);

  await hre.run("verify:verify", {
    address: palToken.address,
    constructorArguments: [
      params.NAME,
      params.SYMBOL
    ],
  });
  console.log()
  if (params.SYMBOL === 'palStkAAVE') {
    await hre.run("verify:verify", {
      address: palPool.address,
      constructorArguments: [
        palToken.address,
        CONTROLLER,
        params.UNDERLYING,
        INTEREST_MODULE_V2,
        DELEGATORS[params.DELEGATOR],
        PAL_LOAN_TOKEN,
        TOKENS.AAVE
      ],
    });
  }
  else {
    await hre.run("verify:verify", {
      address: palPool.address,
      constructorArguments: [
        palToken.address,
        CONTROLLER,
        params.UNDERLYING,
        INTEREST_MODULE_V2,
        DELEGATORS[params.DELEGATOR],
        PAL_LOAN_TOKEN
      ],
    });
  }


  console.log()
  console.log('---------------------------------------------')
  console.log()

  console.log('PalPool :  ' + palPool.address)
  console.log('PalToken :  ' + palToken.address)

  console.log("(the new PalPool will need to be listed in the Paladin Controller)")
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

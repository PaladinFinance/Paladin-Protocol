export { };
const hre = require("hardhat");
const ethers = hre.ethers;

const network = hre.network.name;
const params_path = () => {
  if (network === 'kovan') {
    return '../utils/kovan_params'
  }
  else {
    return '../utils/main_params'
  }
}

const param_file_path = params_path();

const { ORACLE_BASE_SOURCE, ORACLE_ASSET_LIST, CONTROLLER } = require(param_file_path);

let assets: String[] = [];
let sources: String[] = [];
let sourcesUSD: String[] = [];

async function main() {

  console.log('Deploying a new Price Oracle ...')

  const deployer = (await hre.ethers.getSigners())[0];

  for (let a in ORACLE_ASSET_LIST) {
    assets.push(ORACLE_ASSET_LIST[a].ASSET)
    sources.push(ORACLE_ASSET_LIST[a].SOURCE)
    sourcesUSD.push(ORACLE_ASSET_LIST[a].SOURCE_USD)
  }

  const Oracle = await ethers.getContractFactory("PriceOracle");

  const oracle = await Oracle.deploy(
    assets,
    sources,
    sourcesUSD,
    CONTROLLER,
    ORACLE_BASE_SOURCE
  );
  await oracle.deployed();


  console.log('New Price Oracle : ')
  console.log(oracle.address)

  await oracle.deployTransaction.wait(30);

  await hre.run("verify:verify", {
    address: oracle.address,
    constructorArguments: [
        assets,
        sources,
        sourcesUSD,
        CONTROLLER,
        ORACLE_BASE_SOURCE
    ],
  });


}


main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
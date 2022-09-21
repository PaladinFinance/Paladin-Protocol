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

async function main() {

  console.log('Deploying a new Rate Provider ...')

  const palStkAave_pool = "0xCDc3DD86C99b58749de0F697dfc1ABE4bE22216d"

  const deployer = (await hre.ethers.getSigners())[0];

  const RateProvider = await ethers.getContractFactory("PalStkAaveRateProvider");

  const rateProvider = await RateProvider.deploy(
    palStkAave_pool
  );
  await rateProvider.deployed();


  console.log('New Rate Provider : ')
  console.log(rateProvider.address)

  await rateProvider.deployTransaction.wait(30);

  await hre.run("verify:verify", {
    address: rateProvider.address,
    constructorArguments: [
      palStkAave_pool
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
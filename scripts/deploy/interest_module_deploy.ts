export {};
const hre = require("hardhat");
const ethers = hre.ethers;


async function main() {

    console.log('Deploying the Interest Calculator Module ...')

    const deployer = (await hre.ethers.getSigners())[0];

    const Interest = await ethers.getContractFactory("InterestCalculator");

    const interest = await Interest.deploy();
    await interest.deployed();

    console.log('Interest Calculator : ')
    console.log(interest.address)

    await interest.deployTransaction.wait(5);
  
    await hre.run("verify:verify", {
      address: interest.address,
      constructorArguments: [],
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
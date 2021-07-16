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


async function main() {

    console.log('Deploying a new Mock Token ...')

    const deployer = (await hre.ethers.getSigners())[0];

    const Comp = await ethers.getContractFactory("Comp");

    const token = await Comp.deploy(deployer.address);
    await token.deployed();

    console.log('New Mock Token : ')
    console.log(token.address)

    await token.deployTransaction.wait(30);

    await hre.run("verify:verify", {
        address: token.address,
        constructorArguments: [deployer.address],
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
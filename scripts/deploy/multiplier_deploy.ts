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

const { MULTIPLIERS, MULTIPLIER_NAMES } = require(param_file_path);

const multiplierName = MULTIPLIERS.INDEX;

async function main() {

    console.log('Deploying the ' + multiplierName.NAME + ' (' + multiplierName.CONTRACT.GOV + ' Governance)' + ' ...')

    const deployer = (await hre.ethers.getSigners())[0];

    const Multiplier = await ethers.getContractFactory(multiplierName.CONTRACT.NAME);

    let multiplier
    if (multiplierName.CONTRACT.NAME == MULTIPLIER_NAMES.GOVERNOR) {
        multiplier = await Multiplier.deploy(
            multiplierName.CONTRACT.GOVERNOR_ADDRESS,
            multiplierName.POOLS
        )
    }
    else if (multiplierName.CONTRACT.NAME == MULTIPLIER_NAMES.AAVE) {
        multiplier = await Multiplier.deploy(
            multiplierName.CONTRACT.GOVERNANCE_ADDRESS,
            multiplierName.CONTRACT.STRATEGY_ADDRESS,
            multiplierName.POOLS
        )
    }
    await multiplier.deployed();




    console.log(multiplierName.NAME + ' : ')
    console.log(multiplier.address)

    await multiplier.deployTransaction.wait(5);

    if (multiplierName.CONTRACT.NAME == MULTIPLIER_NAMES.GOVERNOR) {
        await hre.run("verify:verify", {
            address: multiplier.address,
            constructorArguments: [
                multiplierName.CONTRACT.GOVERNOR_ADDRESS,
                multiplierName.POOLS
            ],
        });
    }
    else if (multiplierName.CONTRACT.NAME == MULTIPLIER_NAMES.AAVE) {
        await hre.run("verify:verify", {
            address: multiplier.address,
            constructorArguments: [
                multiplierName.CONTRACT.GOVERNANCE_ADDRESS,
                multiplierName.CONTRACT.STRATEGY_ADDRESS,
                multiplierName.POOLS
            ],
        });
    }
}


main()
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
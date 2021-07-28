const { ethers } = require("hardhat");

// Addresses for all_deploy :

const TOKENS = {
    COMP: "0x61460874a7196d6a22D1eE4922473664b3E95270",
    AAVE: "0xB597cd8D3217ea6477232F9217fa70837ff667Af",
    STKAAVE: "0xf2fbf9A6710AfDa1c4AaB2E922DE9D69E0C97fd2",
    UNI: "0x075A36BA8846C6B6F53644fDd3bf17E5151789DC"
}

const DELEGATOR_NAMES = {
    BASIC_DELEGATOR: 'BasicDelegator',
    AAVE_DELEGATOR: 'AaveDelegator',
    AAVE_DELEGATOR_CLAIMER: 'AaveDelegatorClaimer',
    SNAPSHOT_DELEGATOR: 'SnapshotDelegator'
}

const POOLS_PARAMS = {
    COMP: {
        UNDERLYING: TOKENS.COMP,
        DELEGATOR: 'BASIC_DELEGATOR',
        NAME: 'Paladin COMP',
        SYMBOL: 'palCOMP'
    },
    UNI: {
        UNDERLYING: TOKENS.UNI,
        DELEGATOR: 'BASIC_DELEGATOR',
        NAME: 'Paladin UNI',
        SYMBOL: 'palUNI'
    },
    AAVE: {
        UNDERLYING: TOKENS.AAVE,
        DELEGATOR: 'AAVE_DELEGATOR',
        NAME: 'Paladin AAVE',
        SYMBOL: 'palAAVE'
    },
    STKAAVE: {
        UNDERLYING: TOKENS.STKAAVE,
        DELEGATOR: 'AAVE_DELEGATOR_CLAIMER',
        NAME: 'Paladin stkAAVE',
        SYMBOL: 'palStkAAVE'
    }
}

const PAL_LOAN_TOKEN_URI = "about:blank"


//Already deployed contracts : 
const POOLS = {
    COMP: {
        POOL: "0x2ad0827e1Fca16Cf937DaDedF5cE81Ed0848bE28",
        TOKEN: "0xd7b24dCb2B250FAdEa3CfD175F502B9B55cB4A4D"
    },
    UNI: {
        POOL: "0xB1265A6B2C5d43Ff358A847DF64fD825b7ed70e0",
        TOKEN: "0x961692fb4Ca983A116a6432E2b82972094c71cf2"
    },
    AAVE: {
        POOL: "0x62364874FB078C1B839b3234038Bf394b3D29205",
        TOKEN: "0xA4Bd05F52735CecB54f9A21AB61a9d7aD90077a1"
    },
    STKAAVE: {
        POOL: "0xd1Fe8B9E5B038cdE233A7C60Ca8b70ff2164dAAB",
        TOKEN: "0x875195F9A9b7605DD25c368eCF777e91a47601d7"
    }
}

const PAL_LOAN_TOKEN = "0x4F6c21302a0A4a50512c7dD58fDC2B2b4788f9D6";

const CONTROLLER = "0x12692B01B2c0fc42c7daaf0a9Cb8a0B198916156";

const INTEREST_MODULE = "0x037Cea58aCd888115792bceEe7CAdba3d633860a";

const ADDRESS_REGISTRY = "0x961FACC23c1dAee162b6ff142f416E814F2Dea25";

const DELEGATORS = {
    BASIC_DELEGATOR: "0x60F1604c521dE75B1A1c8Ee48614F08BBd01bD3C",
    AAVE_DELEGATOR: "0x3Ad52159D14117535ef516bC3EDcDf353453E500",
    AAVE_DELEGATOR_CLAIMER: "0x9Be38C2Dc14a4BaD40b588d65Fe377C9F9c46495",
    SNAPSHOT_DELEGATOR: "0x1aE113966C29046CaC0490ceaFC7eb1Dc2426f38"
}



module.exports = {
    TOKENS,
    DELEGATOR_NAMES,
    POOLS_PARAMS,
    POOLS,
    PAL_LOAN_TOKEN,
    CONTROLLER,
    INTEREST_MODULE,
    ADDRESS_REGISTRY,
    DELEGATORS,
    PAL_LOAN_TOKEN_URI
};
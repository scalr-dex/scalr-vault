import { toNano, Address, beginCell, address, Cell } from '@ton/core';
import { Vault } from '../wrappers/Vault';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { JettonMaster, JettonWallet, TonClient } from '@ton/ton';
require('dotenv').config();

const NETWORK : String = process.env.MAINNET?? "0"; //"1" or "0"

function missingEnvVar(name: string): never {
    throw new Error(`Missing required env var ${name}`);
}

const JETTON_ADDRESS = Address.parse(process.env.JETTON_ADDRESS?? missingEnvVar("JETTON_ADDRESS"));
const ADMIN_ADDRESS = Address.parse(process.env.ADMIN_ADDRESS?? missingEnvVar("ADMIN_ADDRESS"));
const KEEPER_ADDRESS = Address.parse(process.env.KEEPER_ADDRESS?? missingEnvVar("KEEPER_ADDRESS"));

const HOLE_ADDRESS = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");
const initTempUpgrade = beginCell()
.storeUint(0, 64)
.storeUint(0, 64)
.storeUint(0, 64)
.storeAddress(HOLE_ADDRESS)
.storeAddress(HOLE_ADDRESS)
.storeRef(beginCell().endCell())
.endCell();

export async function run(provider: NetworkProvider) {
    const endpoint = await getHttpEndpoint({
        network: (NETWORK == "1" ? "mainnet" : "testnet")
    }); 

    const client = new TonClient({ endpoint });

    const vault = provider.open(Vault.createFromConfig({
        vaultJettonWallet: HOLE_ADDRESS,
        adminAddress: ADMIN_ADDRESS,
        keeperAddress: KEEPER_ADDRESS,
        tempUpgrade: initTempUpgrade,
    }, await compile('Vault')));


    console.log(vault.address)

    let jettonMaster = JettonMaster.create(JETTON_ADDRESS);
    let jettonMasterContract = client.open(jettonMaster);

    const vaultJettonWallet = await jettonMasterContract.getWalletAddress(vault.address);

    let vaultJettonWalletEnt = JettonWallet.create(vaultJettonWallet)
    let vaultJettonWalletContract = client.open(vaultJettonWalletEnt)

    console.log(await vaultJettonWalletContract.getBalance());

    await vault.sendDeploy(provider.sender(), toNano('0.02'));

    await provider.waitForDeploy(vault.address);

    // if provider is admin
    if (provider.sender().address == ADMIN_ADDRESS) { 
        await vault.sendSetVaultJettonWallet(provider.sender(), {value: toNano('0.01'), vaultJettonWallet: vaultJettonWallet});
    }

    let vaultState = await vault.getVaultData();

    console.log(vaultState)

    // run methods on `vault`

    // let queryId = 0

    // const jettonValue = toNano(5 / 1e3);

    // await vault.sendRequestWithdrawal(provider.sender(), 
    // {value: toNano('0.03'), jettonAmount: jettonValue, userAddress: ADMIN_ADDRESS, queryID: queryId});

    // await vault.sendWithdraw(provider.sender(), 
    // {value: toNano('0.06'), jettonAmount: jettonValue, userAddress: ADMIN_ADDRESS, fwdValue: toNano('0.01'), queryID: queryId});

    // console.log(await vaultJettonWalletContract.getBalance());

}

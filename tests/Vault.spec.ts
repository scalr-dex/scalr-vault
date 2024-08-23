import { Blockchain, SandboxContract, TreasuryContract} from '@ton/sandbox';
import { Cell, toNano, Address, beginCell } from '@ton/core';
import { Opcodes, Vault, VaultConfig } from '../wrappers/Vault';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';


describe('Vault', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Vault');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let keeper: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let vault: SandboxContract<Vault>;

    // for example jetton wallet of UQAj-peZGPH-cC25EAv4Q-h8cBXszTmkch6ba6wXC8BM40qt
    const vaultJettonWallet = Address.parse('EQAmJs8wtwK93thF78iD76RQKf9Z3v2sxM57iwpZZtdQAiVM'); 
    const transferOp = 0xf8a7ea5;
    const HOLE_ADDRESS = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

    const TWODAYS = 2 * 24 * 60 * 60;
    const SEVENDAYS = 7 * 24 * 60 * 60;
    const YEAR = 365 * 24 * 60 * 60;

    const initTempUpgrade = beginCell()
    .storeUint(0, 64)
    .storeUint(0, 64)
    .storeUint(0, 64)
    .storeAddress(HOLE_ADDRESS)
    .storeAddress(HOLE_ADDRESS)
    .storeRef(beginCell().endCell())
    .endCell();

    const value = toNano('0.05');
    const transferFwdFee = toNano('0.01');
    const valueJettons = toNano('1');

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        keeper = await blockchain.treasury('keeper');
        admin = await blockchain.treasury('admin');

        const adminAddress = admin.address;
        const keeperAddress = keeper.address;

        const init_config : VaultConfig = {
            vaultJettonWallet: HOLE_ADDRESS,
            adminAddress: adminAddress, 
            keeperAddress: keeperAddress, 
            tempUpgrade: initTempUpgrade
        };

        vault = blockchain.openContract(Vault.createFromConfig(init_config, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await vault.sendDeploy(deployer.getSender(), toNano('0.01'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vault.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and sample are ready to use

        let vaultInitState = await vault.getVaultData();

        expect(vaultInitState.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);
        expect(vaultInitState.adminAddress).toEqualAddress(admin.address);
        expect(vaultInitState.keeperAddress).toEqualAddress(keeper.address);
        expect(vaultInitState.tempUpgrade).toEqualCell(initTempUpgrade);

        console.log(vaultInitState);
    });

    it('should deposit', async () => {
        const res = await vault.sendTransferNotification(deployer.getSender(), 
        {value: value, amount: valueJettons, sender: deployer.address, 
            forwardPayload: beginCell().endCell()});

        expect(res.transactions).toHaveTransaction({
            op: Opcodes.transferNotification,
            from: deployer.address,
            to: vault.address,
            body: beginCell()
            .storeUint(Opcodes.transferNotification, 32)
            .storeUint(0, 64)
            .storeCoins(valueJettons)
            .storeAddress(deployer.address)
            .storeRef(beginCell().endCell())
            .endCell(),
            aborted: false,
            success: true
        });
    });

    it('should withdrawal request', async () => {
        const res = await vault.sendRequestWithdrawal(deployer.getSender(), 
        {value: value + toNano('0.02'), jettonAmount: valueJettons, userAddress: deployer.address});

        expect(res.transactions).toHaveTransaction({
            op: Opcodes.requestWithdrawal,
            from: deployer.address,
            to: vault.address,
            body: beginCell()
            .storeUint(Opcodes.requestWithdrawal, 32)
            .storeUint(0, 64)
            .storeCoins(valueJettons)
            .storeAddress(deployer.address)
            .endCell(),
            aborted: false,
            success: true
        });

        let valueToKeeper = toNano('0.0682596');

        expect(res.transactions).toHaveTransaction({
            from: vault.address,
            to: keeper.address,
            value: valueToKeeper,
            aborted: false,
            success: true
        })

        expect(await keeper.getBalance() == valueToKeeper);
    });

    it('should refuse withdrawal', async () => {
        const res = await vault.sendRefuseWithdrawal(keeper.getSender(), 
        {value: value, jettonAmount: valueJettons, userAddress: deployer.address});

        expect(res.transactions).toHaveTransaction({
            op: Opcodes.refuseWithdrawal,
            from: keeper.address,
            to: vault.address,
            body: beginCell()
            .storeUint(Opcodes.refuseWithdrawal, 32)
            .storeUint(0, 64)
            .storeCoins(valueJettons)
            .storeAddress(deployer.address)
            .endCell(),
            aborted: false,
            success: true
        });

        expect(res.transactions).toHaveTransaction({
            from: vault.address,
            to: deployer.address,
            value: toNano('0.0482212'),
            aborted: false,
            success: true
        })
    });

    it('should break refuse withdrawal not by keeper', async () => {
        const res = await vault.sendRefuseWithdrawal(deployer.getSender(), 
        {value: value, jettonAmount: valueJettons, userAddress: deployer.address});

        expect(res.transactions).toHaveTransaction({
            op: Opcodes.refuseWithdrawal,
            from: deployer.address,
            to: vault.address,
            body: beginCell()
            .storeUint(Opcodes.refuseWithdrawal, 32)
            .storeUint(0, 64)
            .storeCoins(valueJettons)
            .storeAddress(deployer.address)
            .endCell(),
            aborted: true,
            success: false
        });

        expect(res.transactions).toHaveTransaction({
            from: vault.address,
            to: deployer.address,
            value: toNano('0.0487924'),
            aborted: false,
            success: true
        })
    });


    it('should set jetton wallet by admin', async () => {

        let vaultInitStatePrev = await vault.getVaultData();

        expect(vaultInitStatePrev.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);

        const res = await vault.sendSetVaultJettonWallet(admin.getSender(), 
        {value: value, vaultJettonWallet: vaultJettonWallet});

        expect(res.transactions).toHaveTransaction({
            op: Opcodes.setVaultJettonWallet,
            from: admin.address,
            to: vault.address,
            body: beginCell()
            .storeUint(Opcodes.setVaultJettonWallet, 32)
            .storeUint(0, 64)
            .storeAddress(vaultJettonWallet)
            .endCell(),
            aborted: false,
            success: true
        });

        let vaultInitStateAfter = await vault.getVaultData();

        expect(vaultInitStateAfter.vaultJettonWallet).toEqualAddress(vaultJettonWallet);
    });

    it('should break set jetton wallet not by admin', async () => {

        const res = await vault.sendSetVaultJettonWallet(deployer.getSender(), 
        {value: value, vaultJettonWallet: vaultJettonWallet});

        expect(res.transactions).toHaveTransaction({
            op: Opcodes.setVaultJettonWallet,
            from: deployer.address,
            to: vault.address,
            body: beginCell()
            .storeUint(Opcodes.setVaultJettonWallet, 32)
            .storeUint(0, 64)
            .storeAddress(vaultJettonWallet)
            .endCell(),
            aborted: true,
            success: false
        });
    });

    it('should break withdrawal not by keeper', async () => {
        const res = await vault.sendWithdraw(deployer.getSender(), 
        {value: value, jettonAmount: valueJettons, userAddress: deployer.address, 
            fwdValue: transferFwdFee});

        expect(res.transactions).toHaveTransaction({
            op: Opcodes.withdraw,
            from: deployer.address,
            to: vault.address,
            body: beginCell()
            .storeUint(Opcodes.withdraw, 32)
            .storeUint(0, 64)
            .storeCoins(valueJettons)
            .storeAddress(deployer.address)
            .storeCoins(transferFwdFee)
            .endCell(),
            aborted: true,
            success: false
        });
    });

    it('should withdrawal by keeper', async () => {

        let jettonsWithdrawals = valueJettons;

        const setAddress = await vault.sendSetVaultJettonWallet(admin.getSender(), 
        {value: value, vaultJettonWallet: vaultJettonWallet});

        expect(setAddress.transactions).toHaveTransaction({
            op: Opcodes.setVaultJettonWallet,
            from: admin.address,
            to: vault.address,
            body: beginCell()
            .storeUint(Opcodes.setVaultJettonWallet, 32)
            .storeUint(0, 64)
            .storeAddress(vaultJettonWallet)
            .endCell(),
            aborted: false,
            success: true
        });

        let vaultInitStateAfter = await vault.getVaultData();

        expect(vaultInitStateAfter.vaultJettonWallet).toEqualAddress(vaultJettonWallet);

        const res = await vault.sendWithdraw(keeper.getSender(), 
        {value: value, jettonAmount: jettonsWithdrawals, 
            userAddress: deployer.address, fwdValue: transferFwdFee});

        const transferBody = beginCell()
            .storeUint(transferOp, 32)
            .storeUint(0, 64)
            .storeCoins(jettonsWithdrawals)
            .storeAddress(deployer.address)
            .storeAddress(deployer.address)
            .storeBit(false)
            .storeCoins(transferFwdFee)
            .storeBit(false)
            .endCell();

        expect(res.transactions).toHaveTransaction({
            op: Opcodes.withdraw,
            from: keeper.address,
            to: vault.address,
            body: beginCell()
            .storeUint(Opcodes.withdraw, 32)
            .storeUint(0, 64)
            .storeCoins(valueJettons)
            .storeAddress(deployer.address)
            .storeCoins(transferFwdFee)
            .endCell(),
            aborted: false,
            success: true
        });

        expect(res.transactions).toHaveTransaction({
            op: transferOp,
            from: vault.address,
            to: vaultJettonWallet,
            value: toNano('0.04741'),
            body: transferBody,
            aborted: true,
            success: false,
        });

        expect(res.transactions).toHaveTransaction({
            op: 0xffffffff,
            from: vaultJettonWallet,
            to: vault.address,
            inMessageBounced: true,
            value: toNano('0.04701'),
            aborted: false,
            success: true
        });        
    });

    it('should storage fees cost less than 1 TON', async () => {
        const time1 = Math.floor(Date.now() / 1000);
        const time2 = time1 + YEAR;
    
        blockchain.now = time1;
        const res1 = await vault.sendSetVaultJettonWallet(admin.getSender(), 
        {value: value, vaultJettonWallet: vaultJettonWallet});
    
        blockchain.now = time2;
        const res2 = await vault.sendSetVaultJettonWallet(admin.getSender(), 
        {value: value, vaultJettonWallet: vaultJettonWallet}); 
        
        const tx2 = res2.transactions[1];                                          
        if (tx2.description.type !== 'generic') {
            throw new Error('Generic transaction expected');
        }
    
        // Check that the storagePhase fees are less than 1 TON over the course of a year
        expect(tx2.description.storagePhase?.storageFeesCollected).toBeLessThanOrEqual(toNano('1'));   
    });

    it('should change admin address', async () => {
        const time1 = Math.floor(Date.now() / 1000);                               
        const time2 = time1 + TWODAYS; 
        let newAdmin = deployer.address;                                 

        let vaultInitStateBefore = await vault.getVaultData();
        expect(vaultInitStateBefore.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);
        expect(vaultInitStateBefore.adminAddress).toEqualAddress(admin.address);
        expect(vaultInitStateBefore.keeperAddress).toEqualAddress(keeper.address);
        expect(vaultInitStateBefore.tempUpgrade).toEqualCell(initTempUpgrade);
    
        blockchain.now = time1;                                                    
        const res1 = await vault.sendInitAdminUpgrade(admin.getSender(), 
        {value: value, newAdmin: newAdmin});    

        let vaultInitStateBetween = await vault.getVaultData();
        expect(vaultInitStateBetween.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);
        expect(vaultInitStateBetween.adminAddress).toEqualAddress(admin.address);
        expect(vaultInitStateBetween.keeperAddress).toEqualAddress(keeper.address);
        expect(vaultInitStateBetween.tempUpgrade).toEqualCell(beginCell()
            .storeUint(0, 64)
            .storeUint(time2, 64)
            .storeUint(0, 64)
            .storeAddress(newAdmin)
            .storeAddress(HOLE_ADDRESS)
            .storeRef(beginCell().endCell())
            .endCell())
    
        blockchain.now = time2;                                                    
        const res2 = await vault.sendFinalizeUpgrades(admin.getSender(), 
        {value: value});    
        
        let vaultInitStateAfter = await vault.getVaultData();
        expect(vaultInitStateAfter.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);
        expect(vaultInitStateAfter.adminAddress).toEqualAddress(newAdmin);
        expect(vaultInitStateAfter.keeperAddress).toEqualAddress(keeper.address);
        expect(vaultInitStateAfter.tempUpgrade).toEqualCell(initTempUpgrade);
    });

    it('should change keeper address', async () => {
        const time1 = Math.floor(Date.now() / 1000);                               
        const time2 = time1 + TWODAYS;    
        let newKeeper = deployer.address;                               

        let vaultInitStateBefore = await vault.getVaultData();
        expect(vaultInitStateBefore.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);
        expect(vaultInitStateBefore.adminAddress).toEqualAddress(admin.address);
        expect(vaultInitStateBefore.keeperAddress).toEqualAddress(keeper.address);
        expect(vaultInitStateBefore.tempUpgrade).toEqualCell(initTempUpgrade);
    
        blockchain.now = time1;                                                    
        const res1 = await vault.sendInitKeeperUpgrade(admin.getSender(), 
        {value: value, newKeeper: newKeeper});    

        let vaultInitStateBetween = await vault.getVaultData();
        expect(vaultInitStateBetween.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);
        expect(vaultInitStateBetween.adminAddress).toEqualAddress(admin.address);
        expect(vaultInitStateBetween.keeperAddress).toEqualAddress(keeper.address);
        expect(vaultInitStateBetween.tempUpgrade).toEqualCell(beginCell()
            .storeUint(0, 64)
            .storeUint(0, 64)
            .storeUint(time2, 64)
            .storeAddress(HOLE_ADDRESS)
            .storeAddress(newKeeper)
            .storeRef(beginCell().endCell())
            .endCell())
    
        blockchain.now = time2;                                                    
        const res2 = await vault.sendFinalizeUpgrades(admin.getSender(), 
        {value: value});    
        
        let vaultInitStateAfter = await vault.getVaultData();
        expect(vaultInitStateAfter.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);
        expect(vaultInitStateAfter.adminAddress).toEqualAddress(admin.address);
        expect(vaultInitStateAfter.keeperAddress).toEqualAddress(newKeeper);
        expect(vaultInitStateAfter.tempUpgrade).toEqualCell(initTempUpgrade);
    });

    it('should change code', async () => {
        const time1 = Math.floor(Date.now() / 1000);                               
        const time2 = time1 + SEVENDAYS;    
        
        let newCode = beginCell().storeRef(
            beginCell().storeRef(beginCell()
            .endCell()).endCell()).endCell();

        let vaultInitStateBefore = await vault.getVaultData();
        expect(vaultInitStateBefore.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);
        expect(vaultInitStateBefore.adminAddress).toEqualAddress(admin.address);
        expect(vaultInitStateBefore.keeperAddress).toEqualAddress(keeper.address);
        expect(vaultInitStateBefore.tempUpgrade).toEqualCell(initTempUpgrade);
    
        blockchain.now = time1;                                                    
        const res1 = await vault.sendInitCodeUpgrade(admin.getSender(), 
        {value: value, newCode: newCode});    

        let vaultInitStateBetween = await vault.getVaultData();
        expect(vaultInitStateBetween.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);
        expect(vaultInitStateBetween.adminAddress).toEqualAddress(admin.address);
        expect(vaultInitStateBetween.keeperAddress).toEqualAddress(keeper.address);
        expect(vaultInitStateBetween.tempUpgrade).toEqualCell(beginCell()
            .storeUint(time2, 64)
            .storeUint(0, 64)
            .storeUint(0, 64)
            .storeAddress(HOLE_ADDRESS)
            .storeAddress(HOLE_ADDRESS)
            .storeRef(newCode)
            .endCell())
    
        blockchain.now = time2;                                                    
        const res2 = await vault.sendFinalizeUpgrades(admin.getSender(), 
        {value: value});    
    });

    it('should not change any from not admin', async () => {

        let newAdmin = deployer.address;
        let newKeeper = deployer.address;
        let newCode = beginCell().storeRef(
            beginCell().storeRef(beginCell()
            .endCell()).endCell()).endCell();

        let vaultInitStateBefore = await vault.getVaultData();
        expect(vaultInitStateBefore.vaultJettonWallet).toEqualAddress(HOLE_ADDRESS);
        expect(vaultInitStateBefore.adminAddress).toEqualAddress(admin.address);
        expect(vaultInitStateBefore.keeperAddress).toEqualAddress(keeper.address);
        expect(vaultInitStateBefore.tempUpgrade).toEqualCell(initTempUpgrade);
    
        const res1 = await vault.sendInitCodeUpgrade(deployer.getSender(), 
        {value: value, newCode: newCode});
        expect(res1.transactions).toHaveTransaction({
            op: Opcodes.initCodeUpgrade,
            from: deployer.address,
            to: vault.address,
            aborted: true,
            success: false
        })

        const res2 = await vault.sendInitAdminUpgrade(deployer.getSender(), 
        {value: value, newAdmin: newAdmin});
        expect(res2.transactions).toHaveTransaction({
            op: Opcodes.initAdminUpgrade,
            from: deployer.address,
            to: vault.address,
            aborted: true,
            success: false
        })

        const res3 = await vault.sendInitKeeperUpgrade(deployer.getSender(), 
        {value: value, newKeeper: newKeeper});

        expect(res3.transactions).toHaveTransaction({
            op: Opcodes.initKeeperUpgrade,
            from: deployer.address,
            to: vault.address,
            aborted: true,
            success: false
        })

        let vaultInitStateAfter = await vault.getVaultData();
        expect(vaultInitStateBefore == vaultInitStateAfter);
    });
});
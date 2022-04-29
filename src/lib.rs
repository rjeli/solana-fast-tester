use solana_banks_client::BanksClient;
use solana_program::entrypoint::ProgramResult;
use solana_runtime::{
    bank_forks::BankForks, commitment::BlockCommitmentCache, genesis_utils::GenesisConfigInfo,
};
use solana_sdk::{
    account::Account, commitment_config::CommitmentLevel, genesis_config::GenesisConfig,
    hash::Hash, message::Message, pubkey::Pubkey, signature::Keypair, signer::Signer,
    transaction::Transaction,
};
use std::{
    sync::{Arc, RwLock},
    time::Duration,
};
use tokio::runtime::{self, Runtime};

#[macro_use]
extern crate solana_bpf_loader_program;

mod program_test_context;
mod syscall_stubs;

pub use program_test_context::ProgramTestContext;

pub static LOGGER: FtLogger = FtLogger;

pub struct FtLogger;

impl log::Log for FtLogger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        return false;
    }
    fn log(&self, record: &log::Record) {
        if self.enabled(record.metadata()) {
            println!(
                "[level={} target={} module={}] {}",
                record.level(),
                record.target(),
                record.module_path().unwrap_or("(None)"),
                record.args()
            );
        }
    }
    fn flush(&self) {}
}

async fn slow_msg(msg: &str) {
    println!("slow msg: {}", msg);
    tokio::time::sleep(Duration::from_millis(1000)).await;
}

#[no_mangle]
pub extern "C" fn init_runtime() -> *const Runtime {
    let rt = runtime::Builder::new_current_thread()
        .enable_all()
        // .worker_threads(4)
        .build()
        .unwrap();
    /*
    rt.spawn(async {
        loop {
            slow_msg("loop alive").await;
        }
    });
    */
    Box::into_raw(Box::new(rt))
}

#[no_mangle]
pub extern "C" fn init_ptc(rt_ptr: *const Runtime) -> *mut ProgramTestContext {
    let rt: &Runtime = unsafe { &*rt_ptr };
    // pt.add_program(&program_name, program_id, None);
    log::set_max_level(log::LevelFilter::Trace);
    log::set_logger(&LOGGER).unwrap();
    let ptc = rt.block_on(ProgramTestContext::new(1_400_000));
    return Box::into_raw(Box::new(ptc));
}

unsafe fn read_pubkey(p: *const u8) -> Pubkey {
    let s = std::slice::from_raw_parts(p, 32);
    Pubkey::new_from_array(s.try_into().unwrap())
}

unsafe fn read_u64(p: *const u8) -> u64 {
    let s = std::slice::from_raw_parts(p, 8);
    u64::from_le_bytes(s.try_into().unwrap())
}

#[no_mangle]
pub extern "C" fn set_account(
    ptc_ptr: *mut ProgramTestContext,
    address: *const u8,
    lamports: *const u8,
    data: *const u8,
    data_len: usize,
    owner: *const u8,
    executable: u8,
    rent_epoch: *const u8,
) {
    assert!(!ptc_ptr.is_null());
    let ptc = unsafe { &mut *ptc_ptr };
    let data_slice = unsafe { std::slice::from_raw_parts(data, data_len) };
    let account = Account {
        lamports: unsafe { read_u64(lamports) },
        data: data_slice.to_vec(),
        owner: unsafe { read_pubkey(owner) },
        executable: executable != 0,
        rent_epoch: unsafe { read_u64(rent_epoch) },
    };
    let addr = unsafe { read_pubkey(address) };
    ptc.set_account(&addr, &account.into());
}

/*
#[no_mangle]
pub extern "C" fn add_program(
    rt_ptr: *const Runtime,
    program_name_ptr: *const c_char,
    program_id_ptr: *const u8,
) -> *mut ProgramTestContext {
    let rt: &Runtime = unsafe { &*rt_ptr };

    let program_name_cstr = unsafe { CStr::from_ptr(program_name_ptr) };
    let program_name = program_name_cstr.to_str().unwrap().to_owned();
    let program_id_bytes = unsafe { std::slice::from_raw_parts(program_id_ptr, 32) };
    let program_id = Pubkey::new_from_array(program_id_bytes.try_into().unwrap());
    println!(
        "fast-tester: add_program '{}' '{}'",
        program_name, program_id
    );

    let mut pt = ProgramTest::default();
    pt.add_program(&program_name, program_id, None);
    let ptc = rt.block_on(pt.start_with_context());
    // ptc.warp_to_slot(42).unwrap();
    println!("ok!");
    Box::into_raw(Box::new(ptc))

    /*
    PROGRAM_TEST.with(|pt_cell| {
        let mut pt = pt_cell.borrow_mut();
        pt.add_program(program_name, program_id, None);
    });
    */
    // CTX.with(|ctx| ctx.borrow_mut().programs.push((program_name, program_id)));
}
*/

#[no_mangle]
pub extern "C" fn get_payer(ptc_ptr: *const ProgramTestContext) -> *const u8 {
    assert!(!ptc_ptr.is_null());
    let ptc = unsafe { &*ptc_ptr };
    ptc.payer.to_bytes().to_vec().leak().as_ptr()
}

/*
#[no_mangle]
pub extern "C" fn start(rt_ptr: *mut Runtime) {
    let rt = unsafe { &mut *rt_ptr };
    CTX.with(|ctx_cell| {
        let mut ctx = ctx_cell.borrow_mut();
        let mut pt = ProgramTest::default();
        for (pn, pk) in ctx.programs.iter() {
            pt.add_program(&pn, *pk, None);
        }
        // ctx.ctx = Some(ctx.rt.block_on(pt.start_with_context()));
        let mut ptc = rt.block_on(pt.start_with_context());
        ptc.warp_to_slot(42).unwrap();
        ctx.ctx = Some(ptc);
    });
    println!("ok!");
}
*/

#[no_mangle]
pub extern "C" fn get_latest_blockhash(
    rt_ptr: *const Runtime,
    ptc_ptr: *mut ProgramTestContext,
) -> *const u8 {
    assert!(!rt_ptr.is_null());
    assert!(!ptc_ptr.is_null());
    let rt = unsafe { &*rt_ptr };
    let ptc = unsafe { &mut *ptc_ptr };
    let h = rt
        .block_on(ptc.banks_client.get_latest_blockhash())
        .unwrap();
    println!("latest block hash: {:?}", h);
    let hash_vec = h.to_bytes().to_vec();
    hash_vec.leak().as_ptr()
}

#[no_mangle]
pub extern "C" fn process(
    rt_ptr: *const Runtime,
    ptc_ptr: *mut ProgramTestContext,
    msg_bytes: *const u8,
    msg_len: usize,
    signers_bytes: *const u8,
    num_signers: usize,
) -> u8 {
    let process_start = std::time::Instant::now();
    // eprintln!("processing tx {:?} {}", msg_bytes, msg_len);
    assert!(!rt_ptr.is_null());
    assert!(!ptc_ptr.is_null());
    let rt = unsafe { &*rt_ptr };
    let ptc = unsafe { &mut *ptc_ptr };

    let msg_slice = unsafe { std::slice::from_raw_parts(msg_bytes, msg_len) };
    let msg: Message = bincode::deserialize(msg_slice).unwrap();

    // eprintln!("msg: {:?}", msg);

    let mut tx = Transaction::new_unsigned(msg);
    let recent_blockhash = rt
        .block_on(ptc.banks_client.get_latest_blockhash())
        .unwrap();

    let signers_slice = unsafe { std::slice::from_raw_parts(signers_bytes, num_signers * 64) };
    let signers: Vec<Box<dyn Signer>> = signers_slice
        .chunks_exact(64)
        .map(|c| Box::new(Keypair::from_bytes(c).unwrap()) as _)
        .collect();

    tx.sign(&signers, recent_blockhash);

    // eprintln!("tx: {:?}", tx);

    let t0 = std::time::Instant::now();
    let result = rt.block_on(
        ptc.banks_client
            .process_transaction_with_preflight_and_commitment(tx, CommitmentLevel::Processed),
    );
    /*
    eprintln!(
        "processing took {} ms (from start: {} ms)",
        t0.elapsed().as_millis(),
        process_start.elapsed().as_millis()
    );
    */
    match result {
        Ok(()) => 0,
        Err(e) => {
            eprintln!("fast_tester: error processing tx: {}", e);
            1
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}

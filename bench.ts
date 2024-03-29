import { assertEquals, delay, unreachable, web3 } from "./deps.ts";
import { FastTester } from "./mod.ts";

const ft = new FastTester();

const alice = web3.Keypair.generate();
ft.setAccount({
  address: alice.publicKey,
  lamports: 100n * BigInt(web3.LAMPORTS_PER_SOL),
});
const bob = web3.Keypair.generate();
ft.setAccount({
  address: bob.publicKey,
  lamports: 100n * BigInt(web3.LAMPORTS_PER_SOL),
});

let i = 0;
Deno.bench(
  "solana-fast-tester transfer lamports",
  { group: "transfer" },
  () => {
    ft.process(
      web3.SystemProgram.transfer({
        fromPubkey: alice.publicKey,
        toPubkey: bob.publicKey,
        lamports: i,
      }),
      [alice],
    );
    i++;
  },
);

const rpcUrl = "http://127.0.0.1:8899";

async function startTestValidator() {
  Deno.run({
    cmd: [
      "solana-test-validator",
      "--reset",
      "--bind-address",
      "127.0.0.1",
      "--rpc-port",
      "8899",
    ],
  });
  console.log("waiting for test validator...");
  while (1) {
    await delay(100);
    try {
      const resp = await fetch(`${rpcUrl}/health`);
      console.log({ resp });
      assertEquals(resp.status, 200);
      assertEquals(await resp.text(), "ok");
      return;
    } catch (e) {
      console.error(e);
    }
  }
}

// await startTestValidator();

const conn = new web3.Connection(rpcUrl, {
  fetch,
  commitment: "processed",
});

const s1 = await conn.requestAirdrop(
  alice.publicKey,
  100 * web3.LAMPORTS_PER_SOL,
);
const s2 = await conn.requestAirdrop(
  bob.publicKey,
  100 * web3.LAMPORTS_PER_SOL,
);
await Promise.all([
  conn.confirmTransaction(s1),
  conn.confirmTransaction(s2),
]);

Deno.bench(
  "solana-test-validator transfer lamports",
  { group: "transfer" },
  async () => {
    const ix = web3.SystemProgram.transfer({
      fromPubkey: alice.publicKey,
      toPubkey: bob.publicKey,
      lamports: i,
    });
    const recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    const tx = new web3.Transaction({
      recentBlockhash,
      feePayer: alice.publicKey,
    });
    tx.add(ix);
    tx.sign(alice);
    const sig = await conn.sendTransaction(tx, [alice]);
    await conn.confirmTransaction(sig);
    i++;
  },
);

// ft.close();

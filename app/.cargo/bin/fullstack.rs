// Update .cargo/bin/fullstack.rs
mod dsync;
mod tsync;
use std::thread;
use std::{
    net::{Ipv4Addr, Ipv6Addr, SocketAddrV4, SocketAddrV6, TcpListener, ToSocketAddrs},
    process::{Command, Stdio},
    sync::mpsc,
};

// Port checking functionality
fn test_bind<A: ToSocketAddrs>(addr: A) -> bool {
    TcpListener::bind(addr)
        .map(|t| t.local_addr().is_ok())
        .unwrap_or(false)
}

pub fn is_port_free(port: u16) -> bool {
    let ipv4 = SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, port);
    let ipv6 = SocketAddrV6::new(Ipv6Addr::UNSPECIFIED, port, 0, 0);

    test_bind(ipv6) && test_bind(ipv4)
}

#[cfg(windows)]
pub const NPM: &'static str = "npm.cmd";

#[cfg(not(windows))]
pub const NPM: &str = "npm";

#[allow(clippy::zombie_processes)]
pub fn main() {
    if !is_port_free(21012) {
        println!("========================================================");
        println!(" ViteJS (the frontend compiler/bundler) needs to run on");
        println!(" port 21012 but it seems to be in use.");
        println!("========================================================");
        panic!("Port 21012 is taken but is required for development!")
    }

    let project_dir = env!("CARGO_MANIFEST_DIR");

    // Run dsync and tsync first
    dsync::main();
    tsync::main();

    // Set up a channel for Ctrl+C handling
    let (tx, rx) = mpsc::channel();

    // Set up Ctrl+C handler
    ctrlc::set_handler(move || {
        println!("Received Ctrl+C, shutting down...");
        tx.send(()).expect("Could not send signal");
    })
    .expect("Error setting Ctrl+C handler");

    // Run frontend server in a separate thread
    let frontend_dir = format!("{}/frontend", project_dir);
    let frontend_handle = thread::spawn(move || {
        println!("Starting frontend server...");
        let frontend = Command::new(NPM)
            .args(["run", "start:dev"])
            .current_dir(frontend_dir)
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("Failed to start frontend server");

        // Return the process handle
        frontend
    });

    // Run backend server in the main thread
    println!("Starting backend server...");
    let mut backend = Command::new("cargo")
        .args(["watch", "-x", "run", "-w", "backend"])
        .current_dir(project_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("Failed to start backend server");

    // Wait for Ctrl+C or process termination
    let _ = rx.recv();

    // Kill both processes
    backend.kill().expect("Failed to kill backend process");
    let mut frontend = frontend_handle.join().unwrap();
    frontend.kill().expect("Failed to kill frontend process");

    println!("Development servers shut down");
}

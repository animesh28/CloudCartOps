# Ansible Controller & Jenkins Target Setup Guide

This guide outlines the steps to configure an **Ansible Controller** node, establish **SSH trust** with a target **Jenkins VM**, and execute an Ansible playbook to install Jenkins.

---

## Prerequisites

- Ubuntu/Debian-based system for the Controller  
- Access to the target Jenkins VM (IP address and credentials)  
- Root or sudo privileges on the Controller  

---

## 1. System Update & Dependency Installation

Update package repositories and install required packages such as `OpenSSH` and `pipx` (Python application installer).

```bash
sudo apt update
sudo apt install openssh-server pipx -y
```

---

## 2. Install Ansible

Use `pipx` to install Ansible with all dependencies.

```bash
pipx install --include-deps ansible
```

> **Note:** Ensure `pipx` is in your system PATH.  
> Run the following command if necessary and restart your terminal:
> ```bash
> pipx ensurepath
> ```

---

## 3. Configure Sudo Privileges

Allow password-less sudo access for your user. This ensures automation scripts can execute commands without manual password prompts.

Open or create a user-specific sudo configuration file (commonly used by Azure Linux Agents):

```bash
sudo vim /etc/sudoers.d/waagent
```

Add the following line, replacing **username** with your actual system username:

```
username ALL=(ALL) NOPASSWD:ALL
```

---

## 4. SSH Key Generation & Agent Configuration

Generate an RSA SSH key pair for secure communication between the Controller and Jenkins VM.

### Generate SSH Key

```bash
ssh-keygen -t rsa -b 2048 -f ~/.ssh/id_rsa
```

Press **Enter** through all prompts to accept the defaults (leave passphrase empty for automation).

### Configure SSH Agent Persistence

Ensure your SSH agent automatically starts and loads the key each time you log in.

Open your bash configuration:

```bash
vi ~/.bashrc
```

Add these lines at the end of the file:

```bash
eval $(ssh-agent -s)
ssh-add ~/.ssh/id_rsa
```

Apply the changes immediately:

```bash
source ~/.bashrc
```

---

## 5. Establish SSH Trust with Jenkins VM

Copy your public key to the remote Jenkins server to enable password-less SSH.

> Make sure the **OpenSSH Server** is installed and running on the Jenkins VM.

```bash
ssh-copy-id user@<jenkins_vm_ip_address>
```

Replace `user` and `<jenkins_vm_ip_address>` with your Jenkins VM details.

---

## 6. Run Ansible Playbook

Once SSH trust is established, execute the Ansible playbook to install Jenkins.

```bash
ansible-playbook -i inventories.yml install_jenkins.yml -v
```

### Command Breakdown

| Option | Description |
|---------|--------------|
| `-i inventories.yml` | Defines the inventory file containing target host details |
| `install_jenkins.yml` | The playbook containing tasks to install Jenkins |
| `-v` | Enables verbose output for detailed logs |

---

## Verification

After the playbook completes successfully, verify Jenkins is running by visiting:

```
http://<jenkins_vm_ip_address>:8080
```

---

**Congratulations!**  
Your Ansible Controller and Jenkins Target setup is complete. 🚀
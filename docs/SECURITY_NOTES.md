# Security Notes

## Secret handling rules

- Never commit AWS credential exports, PEM/private keys, `.env` files, webhook URLs, database passwords, or production tokens.
- Keep real values in local `.env` files, the host environment, or a secret manager.
- Use `.env.example` files for placeholders only.
- Keep logs and local tool state out of Git because they can accidentally contain tokens, paths, or operational details.

## Phase 1 cleanup

The following tracked files were removed from the repository in Phase 1:

- `monitoring-user_accessKeys.csv`
- `monitoring-user_credentials.csv`
- `sentinel.pem`
- `docker/.env`

Their contents were not read or copied into documentation.

## Rotation warning

If AWS access keys, credential CSV exports, or PEM private keys were ever committed, pushed, shared, or exposed, deleting them from the current branch is not enough. Treat them as compromised:

- Rotate exposed AWS access keys.
- Disable/delete old IAM access keys after confirming replacement credentials work.
- Replace exposed PEM keys and remove old key-pair access from servers.
- Review cloud audit logs for unexpected usage.

## Production direction

- Prefer AWS assume-role onboarding over static keys.
- Encrypt any stored integration secrets before production use.
- Move production secrets to a managed secret store.
- Add periodic credential rotation and audit logging in a later hardening phase.

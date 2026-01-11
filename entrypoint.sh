#!/bin/bash
set -e

# Fix node_modules permissions if owned by root
if [ -d "/home/ralph/project/webapp/node_modules" ]; then
  if [ "$(stat -c '%U' /home/ralph/project/webapp/node_modules)" = "root" ]; then
    chown -R ralph:ralph /home/ralph/project/webapp/node_modules
  fi
fi

# Drop to ralph user and execute command
exec gosu ralph "$@"

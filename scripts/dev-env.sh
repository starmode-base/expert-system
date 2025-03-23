#!/bin/bash

# Define the .coder file and .env file
CODER_FILE=".coder"
ENV_FILE=".env"

# Function to prompt the user to choose a name without requiring Enter key and suppress input display
prompt_for_name() {
    while true; do
        echo "Pick a name: [M]IKAEL or [S]PENCER"
        read -n1 -s name
        echo # Move to a new line after input
        name=$(echo "$name" | tr '[:lower:]' '[:upper:]') # Convert to uppercase for consistency
        case "$name" in
            M)
                name="MIKAEL"
                echo "$name" > "$CODER_FILE"
                echo "Saved name: $name to $CODER_FILE"
                break
                ;;
            S)
                name="SPENCER"
                echo "$name" > "$CODER_FILE"
                echo "Saved name: $name to $CODER_FILE"
                break
                ;;
            *)
                echo "Invalid choice. Please enter M or S."
                ;;
        esac
    done
}

# Check if .coder file exists
if [[ -f "$CODER_FILE" ]]; then
    # If file exists, read the name inside
    name=$(cat "$CODER_FILE" | tr '[:lower:]' '[:upper:]') # Convert to uppercase for consistency
    if [[ "$name" != "MIKAEL" && "$name" != "SPENCER" ]]; then
        echo "Invalid name found in $CODER_FILE: $name"
        prompt_for_name
    else
        echo "Valid name found in $CODER_FILE: $name"
    fi
else
    # If file doesn't exist, prompt the user to pick a name
    echo "$CODER_FILE not found."
    prompt_for_name
fi

# Determine the appropriate environment variables to update based on the coder's name
if [[ "$name" == "MIKAEL" ]]; then
    PREFIX="MIKAEL_"
    OTHER_PREFIX="SPENCER_"
elif [[ "$name" == "SPENCER" ]]; then
    PREFIX="SPENCER_"
    OTHER_PREFIX="MIKAEL_"
fi

# Update the .env file
echo "Updating .env file: removing existing database variables, renaming $name's variables, and removing the other coder's variables..."

# Use sed to:
# 1. Remove existing DATABASE_URL and DATABASE_URL_UNPOOLED
# 2. Rename the variables by removing the chosen coder's name prefix
# 3. Remove the other coder's variables
sed -i '' \
  -e '/^DATABASE_URL=/d' \
  -e '/^DATABASE_URL_UNPOOLED=/d' \
  -e "s/^${PREFIX}DATABASE_URL=/DATABASE_URL=/" \
  -e "s/^${PREFIX}DATABASE_URL_UNPOOLED=/DATABASE_URL_UNPOOLED=/" \
  -e "/^${OTHER_PREFIX}DATABASE_URL=/d" \
  -e "/^${OTHER_PREFIX}DATABASE_URL_UNPOOLED=/d" \
  "$ENV_FILE"

echo "Database configuration variables have been updated for $name, existing variables have been removed, and the other coder's variables have been removed."

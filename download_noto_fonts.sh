#!/bin/bash

ZIP="$1"

if [ -z "$ZIP" ]; then
    echo "Please pass path to Noto-unhinted.zip as only arg"
    exit 1
fi

FILES="$(unzip -Z1 "$ZIP" | grep -E 'Symbol|Emoji' | grep -E 'Color|-Regular|-Bold')"

unzip -d fonts "$ZIP" $FILES

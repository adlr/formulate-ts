#!/bin/bash

set -e

# Get Google fonts

CSS_URL="https://fonts.googleapis.com/css2?family=Caveat&family=Merriweather:ital,wght@0,400;0,700;1,400;1,700&family=Open+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Roboto"

OUT_DIR=fonts
TEMP="temp.css"
curl -o "$TEMP" "$CSS_URL"

FINAL_CSS="$OUT_DIR/google_fonts.css"
cp "$TEMP" "$FINAL_CSS"

extract() {
  local input="$1"
  local pattern="$2"
  echo "$input" | sed "s/$pattern/\\1/"
}

grep 'src:' "$TEMP" | while read -r line ; do
  ideal_filename=''
  for token in $(echo "$line" | grep -o '\(local\|url\)([^)]*)' | grep -v ' ') ; do
    if echo "$token" | grep -q "local('[a-zA-Z-]*')" ; then
      ideal_filename="$(extract "$token" "[^(]*('\([^']*\)')")"
    fi
    if echo "$token" | grep -q "^url(" ; then
      suffix="$(extract "$token" ".*\.\([a-z0-9]*\))")"
      font_filename="$(extract "$token" ".*\/\([^)]*\))")"
      url="$(extract "$token" ".*(\([^)]*\))")"
      if [ -n "$ideal_filename" ]; then
        font_filename="${ideal_filename}.${suffix}"
        ideal_filename=""  # we used it up
      fi
      curl -o "${OUT_DIR}/${font_filename}" "$url"
      sed -i "s~$url~${font_filename}~" "$FINAL_CSS"
    fi
  done
done


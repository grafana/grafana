#!/bin/bash

input_file="conf/defaults.ini"
output_file="conf/sample.ini"

echo "##################### Grafana Configuration Example ######################" > "$output_file"
echo "#" >> "$output_file"
echo "# Everything has defaults so you only need to uncomment things you want to change" >> "$output_file"

line_number=0
while IFS= read -r line; do
    ((line_number++))
    if [[ $line_number -ge 5 ]]; then
        if [[ $line =~ ^\[ || $line =~ ^# || $line =~ ^$ ]]; then
            echo "$line" >> "$output_file"
        else
            echo ";$line" >> "$output_file"
        fi
    fi
done < "$input_file"
# Bay View Data Processing

This directory contains Python scripts for processing Bay View cottage and leaseholder data from Excel files.

## Setup

1. Ensure Python 3.11.9 is installed via pyenv:
   ```bash
   pyenv install 3.11.9
   pyenv local 3.11.9
   ```

2. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On macOS/Linux
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Files

- **LEASHOLD 4-26-22.XLS** - Main leaseholder database (131KB)
- **block-lot 4-26-22.XLS** - Block and lot mapping (70KB)

## Processing Steps

1. Extract data from Excel files
2. Clean and normalize data
3. Generate JSON for database import
4. Validate against existing schema

## Integration

The processed data will be imported using the existing Node.js scripts in the main project.
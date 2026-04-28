# Instructions

## Change conversion functionality
Cases:

1. If the command is "update" with no target dependency:
    - If the project is an rnpm project:
        - Check integrity and do what we currently do if not ok
    - call runUpdate like we do now
2. If the command is anything else:
    - If the project is not an rnpm project:
        - Ask whether to update and do the rnpm update like we do now
        - Ask the you user whether to ignore scripts:
            - If yes, add the "--ignore-scripts" flag when calling update
        - Ask the user whether to skip physical installation:
            - If yes, add the "--package-lock-only" flag when calling update

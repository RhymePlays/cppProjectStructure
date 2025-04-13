## Style Guide


### Folder Structure
- `src` contains first-party source-code (implementation). Should be further organized into sub-folders. If there's an entry point, it must be `/src/main.cpp`.
- `bin` contains **resulting** compiled-code (executables and libraries) produced by the project. Should be organized into sub-folders for each architecture supported by the project.
- `include` contains headers (declarations) only for source-code files located in `src` and linked libraries in `bin`. Headers must be organized into their corresponding sub-folders under the same name used in the `src` directory.
- `external` contains third-party source-code (implementation) and headers (declarations). Should be organized into sub-folders.
- `lib` contains both first-party (from other projects) and third-party libraries and their corresponding headers (declarations). Should be organized into sub-folders. Those sub folders should then be further organized into sub-folders for each architecture supported by the project.
- `scripts` contains helper scripts to assist with managing and building the project.
- `tests` contains test units to check code quality.
- `build` may contain build artifacts and build cache **not** the final product.


### Build System
- Add system include path.
- Add include path: `./lib/`
- Add include path: `./include/`


### Syntax
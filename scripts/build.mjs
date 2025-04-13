import { exec } from "node:child_process";
import { readFileSync, statSync, mkdirSync } from "node:fs";

class DaemonicBuilder{
    constructor(opts={}){
        /*----------------*\
        |                  |
        |  Loading Config  |
        |                  |
        \*----------------*/
        if (typeof(opts)=="string"){
            console.log(`>----------------<\nLoading Config -> "${opts}"\n>----------------<\n`);
            opts=this.readJSONFromFile(opts);
        }else{
            console.log(`>----------------<\nLoading Config from Object\n>----------------<\n\nDone!`);
        }


        /*------------------------------------*\
        |                                      |  /----------\
        |  Try not to change these parameters  |  |  config  |
        |                                      |  \----------/
        \*------------------------------------*/
        this.compiler=opts.compiler||"g++";
        this.projectDirectory=opts.projectDirectory||process.cwd().replaceAll("\\", "/"); // The project root folder. (the folder that contains the `src`, `lib`, `bin`)
        this.compilationTargetFlags=opts.compilationTargetFlags||{
            "executable": "",
            "dynamicLibrary": " -shared",
            "staticLibrary": " -static", // Not sure 'bout this.
            "objectFile": " -c",
            "assembly": " -S"
        };
        this.compilationPlatformOpts=opts.compilationPlatformOpts||{
            "win-x64": {"dynamicLibraryExtention": "dll", "staticLibraryExtention": "lib", "executableExtention": "exe"},
            "win-x86": {"dynamicLibraryExtention": "dll", "staticLibraryExtention": "lib", "executableExtention": "exe"},
            "linux-x64": {"dynamicLibraryExtention": "so", "staticLibraryExtention": "a", "executableExtention": "out"},
            "linux-x86": {"dynamicLibraryExtention": "so", "staticLibraryExtention": "a", "executableExtention": "out"},
        };
        

        /*----------------------*\
        |                        |  /----------\
        |  Changable Parameters  |  |  config  |
        |                        |  \----------/
        \*----------------------*/
        this.compilationTarget = opts.compilationTarget||Object.keys(this.compilationTargetFlags)[0]; // One of the compilationTargetFlags
        this.compilationPlatform = opts.compilationPlatform||Object.keys(this.compilationPlatformOpts)[0]; // One of the compilationPlatformOpts
        this.additionalFlags = opts.additionalFlags?" "+opts.additionalFlags:""; // Additional compiler flags.
        this.cleanBuild = opts.cleanBuild||false; // Additional compiler flags.
        this.runWhenBuilt = opts.runWhenBuilt||false; // Additional compiler flags.
        this.testWhenBuilt = opts.testWhenBuilt||false; // Additional compiler flags.

        // Files and Folders
        /*----------------------------------*\
        |                                    |  /----------\
        |     {PROJ-DIR} {OS-ARCH} {EXT}     |  |  config  |
        |   Can be used in the file paths.   |  \----------/
        |                                    |
        \*----------------------------------*/
        this.sourceFiles = opts.sourceFiles||["main.{EXT}"]; // Inside the `src` folder.
        this.objectFiles = opts.objectFiles||[]; // Inside the `build` folder. (Avoid using this, use `sourceFiles` instead)
        this.externalSourceFiles = opts.externalSourceFiles||[]; // Inside the `external` folder.
        this.dynamicLibraryFiles = opts.dynamicLibraryFiles||[]; // Inside the `lib` folder.
        this.staticLibraryFiles = opts.staticLibraryFiles||[]; // Inside the `lib` folder.
        this.outputFile = opts.outputFile||"{OS-ARCH}/program.{EXT}"; // Inside the `bin` folder.
        this.additionalIncludePaths = opts.additionalIncludePaths||[]; // Additional include paths.


        /*-------------------*\
        |                     |
        |  Runtime Variables  |
        |                     |
        \*-------------------*/
        this.lastBuildFailed=false;
    }


    /*---------------------------------------*\
    |                                         |
    |  Definitly don't touch the code below!  |
    |                                         |
    \*---------------------------------------*/
    async runSh(command){
        return new Promise((resolve, reject)=>{
            try{
                exec(command, (error, stdout, stderr)=>{
                    if(stderr || error){
                        reject(`${stderr}\n${error}` || "Error!");
                    }else{
                        resolve(stdout || "Done!");
                    }
                });
            }catch(e){
                reject("Error!")
            }
        })
    }
    readJSONFromFile(filePath){
        let returnValue = {};
        try{
            let rawJSON = readFileSync(filePath, "utf-8");
            try{
                returnValue=JSON.parse(rawJSON);
                console.log("Done!");
            }catch(e){
                console.error("JSON Reader: Couldn't decode file. Probably not in JSON.");
            }
        }catch(e){
            console.error("JSON Reader: Couldn't read file.");
        }
        return returnValue;
    }
    makeSureParentPathExists(path){
        let splitPath=path.split("/");
        let dirToMake="";
        for (let i=0;i<(splitPath.length-1);i++){
            dirToMake=dirToMake+splitPath[i]+"/"
        }
        mkdirSync(dirToMake, {recursive: true});
    }
    srcNeedsCleanBuild(srcFile, objFile){
        try{
            const srcFileStat=statSync(srcFile);
            const objFileStat=statSync(objFile);
            return srcFileStat.mtime>objFileStat.mtime;
        }catch{
            return true;
        }

    }


    resolveFilename(fileString, fileType){
        let extToUse=fileType;

        switch (fileType){
            case "sourceFile":
                extToUse=this.compilationPlatformOpts[this.compilationPlatform].sourceFileExtention||"cpp";
                break;
            case "headerFile":
                extToUse=this.compilationPlatformOpts[this.compilationPlatform].sourceFileExtention||"h";
                break;
            case "objectFile":
                extToUse=this.compilationPlatformOpts[this.compilationPlatform].objectFileExtention||"obj";
                break;
            case "assembly":
                extToUse=this.compilationPlatformOpts[this.compilationPlatform].objectFileExtention||"s";
                break;
            case "dynamicLibrary":
                extToUse=this.compilationPlatformOpts[this.compilationPlatform].dynamicLibraryExtention;
                break;
            case "staticLibrary":
                extToUse=this.compilationPlatformOpts[this.compilationPlatform].staticLibraryExtention;
                break;
            case "executable":
                extToUse=this.compilationPlatformOpts[this.compilationPlatform].executableExtention;
                break;
        }

        return fileString.replaceAll("{PROJ-DIR}", this.projectDirectory).replaceAll("{OS-ARCH}", this.compilationPlatform).replaceAll("{EXT}", extToUse);
    }
    async resolveInputFiles(){
        let inputFiles="";
        console.log(`\n>----------------<\nPre Building...\n>----------------<\n`);

        // sourceFiles
        if (this.cleanBuild){
            this.sourceFiles.forEach((item)=>{
                inputFiles=inputFiles+this.resolveFilename(` "{PROJ-DIR}/src/${item}"`, "sourceFile");
            });
        }else{
            for(const item of this.sourceFiles){
                let srcFile = this.resolveFilename(`{PROJ-DIR}/src/${item}`, "sourceFile");
                let objFile = this.resolveFilename(`{PROJ-DIR}/build/src/${this.resolveFilename(item, "sourceFile")}.{EXT}`, "objectFile");

                if(this.srcNeedsCleanBuild(srcFile, objFile)){
                    try{
                        this.makeSureParentPathExists(objFile);
                        await this.runSh(`${this.compiler}${this.compilationTargetFlags.objectFile||""}${this.additionalFlags} "${srcFile}"${this.resolveIncludePaths()} -o "${objFile}"`);
                        inputFiles=inputFiles+` "${objFile}"`;
                    }catch(e){
                        console.error(`--> ${srcFile}\nError Compiling to Object File\nUsing Source File as Fallback`);
                        inputFiles=inputFiles+` "${srcFile}"`;
                    }
                }else{
                    console.log(`Using Pre-built Object File for --> ${srcFile}`);
                    inputFiles=inputFiles+` "${objFile}"`;
                }
            };
        }

        // external sourceFiles
        if (this.cleanBuild){
            this.externalSourceFiles.forEach((item)=>{
                inputFiles=inputFiles+this.resolveFilename(` "{PROJ-DIR}/external/${item}"`, "sourceFile");
            });
        }else{
            for(const item of this.externalSourceFiles){
                let srcFile = this.resolveFilename(`{PROJ-DIR}/external/${item}`, "sourceFile");
                let objFile = this.resolveFilename(`{PROJ-DIR}/build/external/${item}`, "objectFile");

                if(this.srcNeedsCleanBuild(srcFile, objFile)){
                    try{
                        this.makeSureParentPathExists(objFile);
                        await this.runSh(`${this.compiler}${this.compilationTargetFlags.objectFile||""}${this.additionalFlags} "${srcFile}"${this.resolveIncludePaths()} -o "${objFile}"`);
                        inputFiles=inputFiles+` "${objFile}"`;
                    }catch(e){
                        console.error(`--> ${srcFile}\nError Compiling to Object File\nUsing Source File as Fallback`);
                        inputFiles=inputFiles+` "${srcFile}"`;
                    }
                }else{
                    console.log(`Using Pre-built Object File for --> ${srcFile}`);
                    inputFiles=inputFiles+` "${objFile}"`;
                }
            };
        }

        // objectFiles
        this.objectFiles.forEach((item) => {
            inputFiles=inputFiles+this.resolveFilename(` "{PROJ-DIR}/build/${item}"`, "objectFile");
        });
        
        // dynamicLibraries
        this.dynamicLibraryFiles.forEach((item) => {
            inputFiles=inputFiles+this.resolveFilename(` "{PROJ-DIR}/lib/${item}"`, "dynamicLibrary");
        });
        
        // staticLibraries
        this.staticLibraryFiles.forEach((item) => {
            inputFiles=inputFiles+this.resolveFilename(` "{PROJ-DIR}/lib/${item}"`, "staticLibrary");
        });

        console.log("Done!")
        return inputFiles;
    }
    resolveIncludePaths(){
        let includePaths=this.resolveFilename(` -I "{PROJ-DIR}/include/" -I "{PROJ-DIR}/lib/" -I "{PROJ-DIR}/external/"`, "headerFile");
        this.additionalIncludePaths.forEach((item) => {
            includePaths=includePaths+` -I "${item}"`;
        });
        
        return this.resolveFilename(includePaths, "headerFile");
    }
    resolveOutputFile(){
        let outputFile = this.resolveFilename(`{PROJ-DIR}/bin/${this.outputFile}`, this.compilationTarget);
        this.makeSureParentPathExists(outputFile);
        return ` "${outputFile}"`;
    }


    /*--------------------*\
    |                      |
    |  Callable Functions  |
    |                      |
    \*--------------------*/
    async build(){
        // Building the build command and running it.
        let sh = `${this.compiler}${this.compilationTargetFlags[this.compilationTarget]||""}${this.additionalFlags}${await this.resolveInputFiles()}${this.resolveIncludePaths()} -o${this.resolveOutputFile()}`;
        
        console.log(`\n>----------------<\nBuilding with -> ${sh}\n>----------------<\n`);
        await this.runSh(sh).then((retunValue)=>{
            this.lastBuildFailed=false;
            console.log(retunValue);
        }).catch((retunValue)=>{
            this.lastBuildFailed=true;
            console.log(retunValue);
        });

        this.testWhenBuilt? await this.test():null;
        this.runWhenBuilt? await this.run():null;
    }
    async test(){
        // Running tests.
        if(this.compilationTarget=="executable" && !this.lastBuildFailed){
            console.log(`\n>----------------<\nTesting -> ${this.resolveOutputFile()}\n>----------------<\n`);
            await this.runSh(this.resolveFilename(`"node {PROJ-DIR}/tests/test.mjs"`, "mjs")).then(console.log).catch(console.error);
        }
    }
    async run(){
        // Running the output file.
        if(this.compilationTarget=="executable" && !this.lastBuildFailed){
            console.log(`\n>----------------<\nRunning -> ${this.resolveOutputFile()}\n>----------------<\n`);
            await this.runSh(this.resolveOutputFile()).then(console.log).catch(console.error);
        }
    }
    
    
    // ToDo: Auto add files if `{*}.{EXT}` query matches any file.
    // ToDo: Compile parallelly [Use Promises.all with this.runSh()]
    // ToDo: Check Deps [check if the library files exist]
}


/*-------------*\
|               |
|  Entry Point  |
|               |
\*-------------*/
new DaemonicBuilder(process.argv[2]||"./scripts/buildConfig.json").build();
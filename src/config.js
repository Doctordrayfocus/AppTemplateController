// import kubernetes client
const k8s = require("@kubernetes/client-node");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// get kubernetes configuration
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// generate configurations from app template parameters

/**
 * Replaces all occurrences of a string within a main string.
 *
 * @param {string} mainString The string to perform replacements on.
 * @param {string} find The string to search for.
 * @param {string} replace The string to replace the found string with.
 * @returns {string} The string with all occurrences replaced.
 */
const replaceAll = function (mainString, find, replace) {
  return mainString.replace(
    new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"),
    replace,
  );
};

/**
 * Generates Kubernetes configurations based on a template and provided parameters.
 * It reads YAML files from the `configs` directory, performs variable substitution,
 * and returns an array of configuration objects.
 *
 * @async
 * @param {object} templateConfigurations An object containing template parameters,
 *                                         including `configsToUse` (comma-separated list of folder names)
 *                                         and `templateVariables` (JSON string of key-value pairs for substitution).
 * @returns {Promise<Array<object>>} A promise that resolves with an array of configuration objects.
 *                                  Each object has `type` (filename without extension) and `content` (YAML string).
 *                                  Returns an empty array if no configurations are found.
 * @throws {Error} If there's an error reading files or processing the template.
 */
const generateConfig = async (templateConfigurations) => {
  const allConfigs = [];

  let configsToUse = [];

  if (templateConfigurations.hasOwnProperty("configsToUse")) {
    configsToUse = templateConfigurations.configsToUse.split(",");
    console.log({
      configsToUse,
    });
  }

  // extract templateVariables
  let templateVariables = {};
  if (templateConfigurations.hasOwnProperty("templateVariables")) {
    templateVariables = JSON.parse(templateConfigurations.templateVariables);
  }
  const templateConfig = { ...templateConfigurations, ...templateVariables };

  return new Promise(async (resolveMain) => {
    /**
     * Reads all files within a specified directory.
     *
     * @param {string} [folder=""] The relative path to the folder within the `configs` directory.
     * @returns {Promise<{files: Array<string>, folder: string}>} A promise resolving to an object containing
     *                                                            an array of filenames and the folder path.
     */
    const readFolderFiles = (folder = "") => {
      return new Promise((resolve) => {
        fs.readdir(
          path.join(__dirname, `../configs${folder !== "" ? folder : ""}`),
          (err, files) => {
            resolve({
              files,
              folder,
            });
          },
        );
      });
    };

    const files = [];

    // Get root files and folders
    const rootFileAndFolders = await readFolderFiles();

    /**
     * Recursively traverses the `configs` directory, identifying and processing YAML configuration files
     * within folders specified by the `configsToUse` parameter.
     *
     * @async
     * @returns {Promise<void>} A promise that resolves when all files are processed.
     */
    const getAllConfigFiles = async () => {
      /**
       * Recursive helper function to process files and folders.
       *
       * @async
       * @param {string} item Filename or folder name being processed.
       * @param {string} [folder=""] Current folder path.
       * @returns {Promise<void>} A promise resolving when the item is processed.
       */
      const getFilesInFolders = async (item, folder = "") => {
        const itemIsFolder = item.split(".").length === 1;

        if (itemIsFolder) {
          const folderName = `${folder === "" ? `/${item}` : `${folder}`}`;

          const useConfigFolder =
            (folderName.includes(`extras-${templateConfig.serviceName}`) ||
              configsToUse.includes(folderName.substring(1))) &&
            !folderName.includes(".git");

          console.log("folder detected: " + folderName);

          if (useConfigFolder) {
            const fileFolder = await readFolderFiles(folderName);

            const allPromises = [];

            fileFolder.files.forEach((subItem) => {
              allPromises.push(
                getFilesInFolders(subItem, fileFolder.folder + "/" + subItem),
              );
            });

            await Promise.all(allPromises);
          }
        } else {
          const fullFilePath = `${folder !== "" ? folder : item}`;

          if (
            fullFilePath.split(".")[1] === "yaml" ||
            fullFilePath.split(".")[1] === "yml"
          ) {
            files.push(fullFilePath);
          }
        }
      };

      const allPromises = [];
      rootFileAndFolders.files.forEach((item) => {
        allPromises.push(getFilesInFolders(item, ""));
      });

      await Promise.all(allPromises);
    };

    await getAllConfigFiles();

    /**
     * Reads a file, performs template substitution based on `templateConfig`, and returns
     * a configuration object.
     *
     * @param {string} file The relative path to the file within the `configs` directory.
     * @returns {Promise<{type: string, content: string} | null>} A promise resolving to an object containing the
     *                                                              configuration `type` and the processed `content` (YAML string),
     *                                                              or `null` if there was an error reading the file.
     */
    const readAndMakeTemplate = (file) => {
      return new Promise((resolve) => {
        fs.readFile(
          path.join(__dirname, `../configs/${file}`),
          { encoding: "utf-8" },
          function (err, data) {
            if (!err) {
              let stringValue = `${data}`;
              for (const key in templateConfig) {
                if (templateConfig.hasOwnProperty(key)) {
                  const value = templateConfig[key];
                  stringValue = replaceAll(
                    stringValue,
                    "${" + key + "}",
                    value,
                  );
                }
              }
              const configType = file.split(".")[0].toLocaleLowerCase();

              resolve({
                type: configType,
                content: stringValue,
              });
            } else {
              console.log(err);
              resolve(null);
            }
          },
        );
      });
    };

    /**
     * Processes all identified configuration files, reads their content, applies the template,
     * and populates the `allConfigs` array.
     *
     * @async
     * @returns {Promise<void>} A promise that resolves when all files are processed.
     */
    const configForAllFiles = async () => {
      const allPromises = [];
      files.forEach(async (file) => {
        allPromises.push(
          readAndMakeTemplate(file)
            .then((fileConfig) => {
              if (fileConfig) {
                allConfigs.push(fileConfig);
              }
            })
            .catch((err) => {
              console.log(err);
            }),
        );
      });
      await Promise.all(allPromises);
      resolveMain(allConfigs);
    };

    await configForAllFiles();
  });
};

/**
 * Applies Kubernetes configurations by creating or patching resources using the K8s API.
 * It parses the YAML string, identifies valid resource specifications, and attempts to
 * create or update each resource in the cluster.
 *
 * @async
 * @param {string} yamlString A YAML string containing one or more Kubernetes resource definitions.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of the created or patched resource objects.
 * @throws {Error} If there's an error parsing the YAML string or interacting with the K8s API.
 */
const applyConfiguration = async (yamlString) => {
  const client = k8s.KubernetesObjectApi.makeApiClient(kc);
  const specs = yaml.loadAll(yamlString);
  const validSpecs = specs.filter((s) => s && s.kind && s.metadata);
  const created = [];
  for (const spec of validSpecs) {
    spec.metadata = spec.metadata || {};
    spec.metadata.annotations = spec.metadata.annotations || {};
    delete spec.metadata.annotations[
      "kubectl.kubernetes.io/last-applied-configuration"
    ];
    spec.metadata.annotations[
      "kubectl.kubernetes.io/last-applied-configuration"
    ] = JSON.stringify(spec);
    try {
      // try to get the resource, if it does not exist an error will be thrown and we will end up in the catch
      // block.
      await client.read(spec);
      // we got the resource, so it exists, so patch it
      //
      // Note that this could fail if the spec refers to a custom resource. For custom resources you may need
      // to specify a different patch merge strategy in the content-type header.
      //
      // See: https://github.com/kubernetes/kubernetes/issues/97423
      const response = await client.patch(spec);
      created.push(response.body);
    } catch (e) {
      // we did not get the resource, so it does not exist, so create it
      try {
        const response = await client.create(spec);
        created.push(response.body);
      } catch (error) {
        console.log(error);
      }
    }
  }
  return created;
};

// create or update app configurations using the template configurations

const enviromentData = process.env;

/**
 * Applies an application template by generating configurations and applying them to the Kubernetes cluster.
 * It combines template configurations with environment variables and processes all configurations,
 * applying the namespace configuration first, followed by other configurations.
 *
 * @async
 * @param {object} templateConfig An object containing template parameters and environment variables.
 * @throws {Error} If there's an error generating configurations or applying them to the K8s cluster.
 */
const applyAppTemplate = async (templateConfig) => {
  const templateAndEnvironmentData = { ...templateConfig, ...enviromentData };

  const processedConfigs = await generateConfig(templateAndEnvironmentData);

  try {
    if (processedConfigs.length > 0) {
      // apply namespace first

      const namespaceConfig = processedConfigs.filter((configData) => {
        return configData.type == "namespace";
      });

      await applyConfiguration(namespaceConfig[0].content);

      // apply other configurations

      const otherConfig = processedConfigs.filter((configData) => {
        return configData.type != "namespace";
      });

      otherConfig.forEach(async (configData) => {
        await applyConfiguration(configData.content);
      });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  applyAppTemplate,
};

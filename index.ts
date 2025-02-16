import express from "express";
import type { Request, Response } from "express";
import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

app.use(cors());
app.use(express.json());

const MOCK_TOKENS = {
  "UNI": {
    "token": "0x6c8D1fd3AA9F436CBA20E4b6A5aeDb1bf814A732",
    "staking": "0xa976c4930e253CE56Ff129404a95F0578345C113",
    "nameProject": "Uniswap"
  },
  "USDC": {
    "token": "0x94F0Fd09f425Be15C7Bc0575Aa71780A044039e3",
    "staking": "0x23218e77D017AD293496976A5ee9Eb3F3F5EF217",
    "nameProject": "AaveV3"
  },
  "USDT": {
    "token": "0x7598099fFC36dCC3e96F3aB33f18E86F85ae7E44",
    "staking": "0xd39ef51d10FAeE75FE6fe66537F3D8128Ec72dA5",
    "nameProject": "CompoundV3"
  },
  "DAI": {
    "token": "0x74A8Ee760959AF0B18307861e92769CfEcC42f9B",
    "staking": "0x60e78201ac487E5C382379dc8f9e39a896396728",
    "nameProject": "StargateV3"
  },
  "WETH": {
    "token": "0x3455b6B22cBD998512286428De8844CBFBcc06C2",
    "staking": "0xF50c64a2C422C6809e5BdbcF4Bb5af38D06a033a",
    "nameProject": "UsdxMoney"
  }
}

const LOGOS = {
  [MOCK_TOKENS.UNI.token]: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
  [MOCK_TOKENS.USDC.token]: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
  [MOCK_TOKENS.USDT.token]: "https://cryptologos.cc/logos/tether-usdt-logo.png",
  [MOCK_TOKENS.DAI.token]: "https://cryptologos.cc/logos/dai-dai-logo.png",
  [MOCK_TOKENS.WETH.token]: "https://img.cryptorank.io/coins/weth1701090834118.png",
};

const stakingABI = [
  "function fixedAPY() public view returns (uint8)",
  "function totalAmountStaked() public view returns (uint256)",
];

async function updateStakingData(tokenKey: keyof typeof MOCK_TOKENS) {
  try {
    const { token, staking } = MOCK_TOKENS[tokenKey];
    const contract = new ethers.Contract(staking, stakingABI, provider);

    const apy = await contract.fixedAPY();
    const totalStaked = await contract.totalAmountStaked();

    const formattedTVL = Number(ethers.formatUnits(totalStaked, 6));
    const formattedAPY = Number(apy);

    await prisma.staking.upsert({
      where: { addressToken: token },
      update: {
        tvl: formattedTVL,
        apy: formattedAPY,
        updatedAt: new Date()
      },
      create: {
        idProtocol: MOCK_TOKENS[tokenKey].nameProject + "_" + tokenKey,
        addressToken: token,
        addressStaking: staking,
        nameToken: tokenKey,
        nameProject: MOCK_TOKENS[tokenKey].nameProject,
        chain: "Manta Pacific Sepolia",
        apy: formattedAPY,
        stablecoin: tokenKey === "USDC" || tokenKey === "USDT" ? true : false,
        categories: ["Staking", tokenKey === "USDC" || tokenKey === "USDT" ? "Stablecoin" : ""].filter(Boolean),
        logo: LOGOS[token] || "",
        tvl: formattedTVL,
      },
    });

    console.log(`Updated staking data for ${tokenKey}`);
  } catch (error) {
    console.error(`Error updating staking data for ${tokenKey}:`, error);
  }
}

const getStakingData = async (req: Request, res: Response) => {
  try {
    const data = await prisma.staking.findMany();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
};

const getStakingByIdProtocol = async (req: any, res: any) => {
  try {
    const data = await prisma.staking.findMany({
      where: { idProtocol: req.params.idProtocol },
    });

    if (!data) {
      return res.status(404).json({ error: "Staking data not found" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
};

const getStakingByAddress = async (req: any, res: any) => {
  try {
    const data = await prisma.staking.findUnique({
      where: { addressToken: req.params.address },
    });

    if (!data) {
      return res.status(404).json({ error: "Staking data not found" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
};

const updateStaking = async (req: Request, res: Response) => {
  try {
    const updatePromises = Object.keys(MOCK_TOKENS).map((tokenKey) =>
      updateStakingData(tokenKey as keyof typeof MOCK_TOKENS)
    );

    await Promise.all(updatePromises);

    res.json({ message: "All staking data updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update staking data" });
  }
};

app.get("/staking", getStakingData);
app.get("/staking/:idProtocol", getStakingByIdProtocol);
app.get("/staking/:address", getStakingByAddress);
app.post("/staking/update", updateStaking);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;

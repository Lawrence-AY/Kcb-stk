import { Request, Response, NextFunction } from 'express';
import { isInSubnet } from 'is-in-subnet';
import { env } from '../config/env';
import { logger } from './logger';

function isIpAllowed(ip: string): boolean {
  if (!env.ALLOWED_IPS.length) return true;

  return env.ALLOWED_IPS.some(entry => {
    // If entry already has a CIDR mask (contains '/'), use it as is
    if (entry.includes('/')) {
      try {
        return isInSubnet(ip, entry);
      } catch (err) {
        logger.warn(`Invalid CIDR entry: ${entry}`, err);
        return false;
      }
    } else {
      // Convert a plain IP to a CIDR with a full mask: /32 for IPv4, /128 for IPv6
      const cidr = entry.includes(':') ? `${entry}/128` : `${entry}/32`;
      try {
        return isInSubnet(ip, cidr);
      } catch (err) {
        logger.warn(`Invalid IP entry: ${entry} (converted to ${cidr})`, err);
        return false;
      }
    }
  });
}

function isCountryAllowed(countryCode: string): boolean {
  if (!env.ALLOWED_COUNTRIES.length) return true;
  // If no country header (e.g., when not behind Cloudflare), allow the request
  if (!countryCode) return true;
  return env.ALLOWED_COUNTRIES.includes(countryCode.toUpperCase());
}

export const whitelistIpAndGeo = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = req.ip || req.socket.remoteAddress || '';
  const country = (req.headers['cf-ipcountry'] as string) || '';

  if (!isIpAllowed(clientIp)) {
    logger.warn(`Blocked IP: ${clientIp}`);
    return res.status(403).json({ error: 'IP not allowed' });
  }

  if (!isCountryAllowed(country)) {
    logger.warn(`Blocked country: ${country} for IP ${clientIp}`);
    return res.status(403).json({ error: 'Geographic location not allowed' });
  }

  next();
};

export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (!env.API_KEY_FOR_BACKEND) {
    return next();
  }
  if (apiKey !== env.API_KEY_FOR_BACKEND) {
    logger.warn(`Invalid API key attempt from IP ${req.ip}`);
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};